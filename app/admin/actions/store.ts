"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseBRLToCents } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { isValidCEP, onlyDigits, UFS } from "@/lib/br";
import { changeOrderStatus, STATUS_LABEL } from "@/server/orders";
import { sendOrderStatus } from "@/server/email";
import { refundPayment } from "@/server/payments/mercadopago";
import { storeImage, UploadError } from "@/server/storage";
import type { AdminState } from "./products";

const issues = (e: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
};
const str = (f: FormData, k: string) => ((f.get(k) as string | null) ?? "").trim();
const optDate = (v: string) => (v ? new Date(`${v}T00:00:00-03:00`) : null);
const optDateEnd = (v: string) => (v ? new Date(`${v}T23:59:59-03:00`) : null);

async function maybeUpload(f: FormData, key: string, folder: string) {
  const file = f.get(key);
  if (!(file instanceof File) || file.size === 0) return undefined;
  return storeImage(file, folder);
}

// ───────────── Pedidos ─────────────

export async function changeStatusAction(orderId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const to = str(form, "status") as OrderStatus;
  if (!(to in STATUS_LABEL)) return { error: "Situação inválida." };
  const tracking = str(form, "trackingCode");
  try {
    if (to === "SHIPPED") {
      if (!tracking) return { fieldErrors: { trackingCode: "Informe o código de rastreio para marcar como enviado." } };
      await db.shipment.upsert({
        where: { orderId },
        update: { trackingCode: tracking, status: "POSTED", postedAt: new Date(), carrier: str(form, "carrier") || undefined },
        create: { orderId, provider: "manual", serviceId: "manual", serviceName: str(form, "carrier") || "Envio", priceCents: 0, trackingCode: tracking, status: "POSTED", postedAt: new Date() },
      });
    }
    if (to === "DELIVERED") await db.shipment.updateMany({ where: { orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await changeOrderStatus(orderId, to, user.id, str(form, "note") || null);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await audit({ actorId: user.id, action: "order.status", entityType: "Order", entityId: orderId, after: { status: to } });
  if (["PREPARING", "SHIPPED", "DELIVERED", "READY_FOR_PICKUP", "PICKED_UP", "CANCELED"].includes(to) && form.get("notify") === "on") {
    after(() => sendOrderStatus(orderId).catch((e) => console.error("[e-mail]", e)));
  }
  revalidatePath(`/admin/pedidos`);
  return { ok: true, message: `Pedido atualizado: ${STATUS_LABEL[to]}.` };
}

export async function saveTrackingAction(orderId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const code = str(form, "trackingCode").slice(0, 60);
  await db.shipment.upsert({
    where: { orderId },
    update: { trackingCode: code || null, carrier: str(form, "carrier") || undefined },
    create: { orderId, provider: "manual", serviceId: "manual", serviceName: str(form, "carrier") || "Envio", priceCents: 0, trackingCode: code || null },
  });
  await audit({ actorId: user.id, action: "order.tracking", entityType: "Order", entityId: orderId, after: { code } });
  revalidatePath(`/admin/pedidos`);
  return { ok: true, message: "Rastreio salvo." };
}

/** Estorno total pelo Mercado Pago. O pedido vira "Reembolsado" quando o provedor confirmar. */
export async function refundAction(orderId: string): Promise<AdminState> {
  const user = await requireAdmin();
  const payment = await db.payment.findFirst({ where: { orderId, status: "APPROVED", provider: "mercadopago" }, orderBy: { createdAt: "desc" } });
  if (!payment?.providerPaymentId) return { error: "Não há pagamento aprovado para estornar neste pedido." };
  try {
    await refundPayment(payment.providerPaymentId, `refund:${payment.id}`);
  } catch (e) {
    return { error: `O Mercado Pago recusou o estorno: ${(e as Error).message}` };
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
  await changeOrderStatus(orderId, "REFUNDED", user.id, "Estorno solicitado pelo painel").catch(() => undefined);
  await audit({ actorId: user.id, action: "order.refund", entityType: "Order", entityId: orderId });
  revalidatePath(`/admin/pedidos`);
  return { ok: true, message: "Estorno solicitado. O valor volta para a cliente conforme o meio de pagamento." };
}

// ───────────── Categorias ─────────────

const categorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(60),
  description: z.string().trim().max(300),
  position: z.coerce.number().int().min(0).max(999),
  isVisible: z.boolean(),
});

export async function saveCategoryAction(id: string | null, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const p = categorySchema.safeParse({ name: str(form, "name"), description: str(form, "description"), position: str(form, "position") || 0, isVisible: form.get("isVisible") === "on" });
  if (!p.success) return { fieldErrors: issues(p.error) };
  let slug = slugify(str(form, "slug") || p.data.name) || "categoria";
  const clash = await db.category.findUnique({ where: { slug } });
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const data = { ...p.data, description: p.data.description || null, slug };
  const saved = id ? await db.category.update({ where: { id }, data }) : await db.category.create({ data });
  await audit({ actorId: user.id, action: id ? "category.update" : "category.create", entityType: "Category", entityId: saved.id, after: data });
  revalidatePath("/admin/categorias");
  return { ok: true, message: "Categoria salva." };
}

export async function deleteCategoryAction(id: string): Promise<AdminState> {
  const user = await requireStaff();
  const count = await db.product.count({ where: { categoryId: id } });
  await db.category.delete({ where: { id } });
  await audit({ actorId: user.id, action: "category.delete", entityType: "Category", entityId: id });
  revalidatePath("/admin/categorias");
  return { ok: true, message: count ? `Categoria excluída. ${count} produtos ficaram sem categoria.` : "Categoria excluída." };
}

// ───────────── Coleções ─────────────

export async function saveCollectionAction(id: string | null, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const name = str(form, "name");
  if (name.length < 2) return { fieldErrors: { name: "Informe o nome." } };
  let slug = slugify(str(form, "slug") || name) || "colecao";
  const clash = await db.collection.findUnique({ where: { slug } });
  if (clash && clash.id !== id) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  let cover;
  try {
    cover = await maybeUpload(form, "cover", "colecoes");
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha ao enviar a capa." };
  }
  const data: Prisma.CollectionUncheckedCreateInput = {
    name, slug, description: str(form, "description").slice(0, 600) || null,
    isFeatured: form.get("isFeatured") === "on", isVisible: form.get("isVisible") === "on",
    position: Number(str(form, "position")) || 0,
    startsAt: optDate(str(form, "startsAt")), endsAt: optDateEnd(str(form, "endsAt")),
    ...(cover ? { coverImage: cover.url } : {}),
  };
  if (form.get("removeCover") === "on") data.coverImage = null;
  const saved = id ? await db.collection.update({ where: { id }, data }) : await db.collection.create({ data });
  await audit({ actorId: user.id, action: id ? "collection.update" : "collection.create", entityType: "Collection", entityId: saved.id });
  revalidatePath("/admin/colecoes");
  return { ok: true, message: "Coleção salva." };
}

export async function deleteCollectionAction(id: string) {
  const user = await requireStaff();
  await db.collection.delete({ where: { id } });
  await audit({ actorId: user.id, action: "collection.delete", entityType: "Collection", entityId: id });
  revalidatePath("/admin/colecoes");
}

// ───────────── Cupons ─────────────

const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Use de 3 a 30 letras, números, hífen ou _."),
  description: z.string().trim().max(200),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.string(),
  minOrder: z.string(),
  maxUses: z.string(),
  maxUsesPerCustomer: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  isActive: z.boolean(),
});

export async function saveCouponAction(id: string | null, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const p = couponSchema.safeParse({
    code: str(form, "code"), description: str(form, "description"), type: str(form, "type"), value: str(form, "value"),
    minOrder: str(form, "minOrder"), maxUses: str(form, "maxUses"), maxUsesPerCustomer: str(form, "maxUsesPerCustomer"),
    startsAt: str(form, "startsAt"), endsAt: str(form, "endsAt"), isActive: form.get("isActive") === "on",
  });
  if (!p.success) return { fieldErrors: issues(p.error) };
  const d = p.data;
  const value = d.type === "PERCENT" ? Number(d.value.replace(",", ".")) : parseBRLToCents(d.value);
  if (value == null || !Number.isFinite(value) || value <= 0) return { fieldErrors: { value: "Informe o valor do desconto." } };
  if (d.type === "PERCENT" && (value > 100 || !Number.isInteger(value))) return { fieldErrors: { value: "Porcentagem inteira de 1 a 100." } };
  const toInt = (v: string) => (v ? Math.max(1, Math.floor(Number(v))) : null);
  const data = {
    code: d.code, description: d.description || null, type: d.type, value,
    minOrderCents: d.minOrder ? parseBRLToCents(d.minOrder) : null, maxUses: toInt(d.maxUses), maxUsesPerCustomer: toInt(d.maxUsesPerCustomer),
    startsAt: optDate(d.startsAt), endsAt: optDateEnd(d.endsAt), isActive: d.isActive,
  };
  try {
    const saved = id ? await db.coupon.update({ where: { id }, data }) : await db.coupon.create({ data });
    await audit({ actorId: user.id, action: id ? "coupon.update" : "coupon.create", entityType: "Coupon", entityId: saved.id, after: data });
  } catch (e) {
    if ((e as Prisma.PrismaClientKnownRequestError).code === "P2002") return { fieldErrors: { code: "Já existe um cupom com esse código." } };
    throw e;
  }
  revalidatePath("/admin/cupons");
  return { ok: true, message: "Cupom salvo." };
}

export async function toggleCouponAction(id: string, active: boolean) {
  const user = await requireStaff();
  await db.coupon.update({ where: { id }, data: { isActive: active } });
  await audit({ actorId: user.id, action: "coupon.toggle", entityType: "Coupon", entityId: id, after: { active } });
  revalidatePath("/admin/cupons");
}

// ───────────── Banners ─────────────

export async function saveBannerAction(id: string | null, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const placement = str(form, "placement");
  if (!["hero", "editorial"].includes(placement)) return { error: "Local inválido." };
  let image, imageMobile;
  try {
    image = await maybeUpload(form, "image", "banners");
    imageMobile = await maybeUpload(form, "imageMobile", "banners");
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha ao enviar a imagem." };
  }
  const href = str(form, "ctaHref");
  if (href && !href.startsWith("/") && !/^https:\/\//.test(href)) return { fieldErrors: { ctaHref: "Use um caminho da loja (/produtos) ou um link https." } };
  const data: Prisma.BannerUncheckedCreateInput = {
    placement, title: str(form, "title").slice(0, 80) || null, subtitle: str(form, "subtitle").slice(0, 240) || null,
    ctaLabel: str(form, "ctaLabel").slice(0, 40) || null, ctaHref: href || null, imageAlt: str(form, "imageAlt").slice(0, 200) || null,
    position: Number(str(form, "position")) || 0, isActive: form.get("isActive") === "on",
    startsAt: optDate(str(form, "startsAt")), endsAt: optDateEnd(str(form, "endsAt")),
    ...(image ? { imageUrl: image.url } : {}), ...(imageMobile ? { imageMobileUrl: imageMobile.url } : {}),
  };
  if (!id && !image) return { fieldErrors: { image: "Envie a foto do banner." } };
  if (data.isActive && !data.imageAlt) return { fieldErrors: { imageAlt: "Descreva a foto (acessibilidade)." } };
  const saved = id ? await db.banner.update({ where: { id }, data }) : await db.banner.create({ data });
  await audit({ actorId: user.id, action: id ? "banner.update" : "banner.create", entityType: "Banner", entityId: saved.id });
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true, message: "Banner salvo." };
}

export async function deleteBannerAction(id: string) {
  const user = await requireStaff();
  await db.banner.delete({ where: { id } });
  await audit({ actorId: user.id, action: "banner.delete", entityType: "Banner", entityId: id });
  revalidatePath("/admin/banners");
  revalidatePath("/");
}

// ───────────── Configurações ─────────────

async function updateSettings(actorId: string, data: Prisma.SiteSettingsUpdateInput, action: string) {
  const before = await db.siteSettings.findUnique({ where: { id: "singleton" } });
  await db.siteSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...(data as Prisma.SiteSettingsCreateInput) } });
  await audit({ actorId, action, entityType: "SiteSettings", entityId: "singleton", before: before ? { ...before, updatedAt: undefined } : undefined, after: data });
  revalidatePath("/", "layout");
}

export async function saveStoreInfoAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireAdmin();
  const cnpj = onlyDigits(str(form, "cnpj"));
  if (cnpj && cnpj.length !== 14) return { fieldErrors: { cnpj: "CNPJ tem 14 números." } };
  const whatsapp = onlyDigits(str(form, "whatsapp"));
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 11)) return { fieldErrors: { whatsapp: "WhatsApp com DDD." } };
  const email = str(form, "contactEmail");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { fieldErrors: { contactEmail: "E-mail inválido." } };
  const insta = str(form, "instagramUrl");
  if (insta && !/^https:\/\/(www\.)?instagram\.com\//.test(insta)) return { fieldErrors: { instagramUrl: "Use o link do perfil do Instagram." } };
  let logo;
  try {
    logo = await maybeUpload(form, "logo", "marca");
  } catch (e) {
    return { error: e instanceof UploadError ? e.message : "Falha ao enviar o logo." };
  }
  await updateSettings(user.id, {
    legalName: str(form, "legalName") || null,
    cnpj: cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null,
    whatsapp: whatsapp || null, contactEmail: email || null, instagramUrl: insta || null,
    announcementText: str(form, "announcementText").slice(0, 120) || null,
    ...(logo ? { logoUrl: logo.url } : {}), ...(form.get("removeLogo") === "on" ? { logoUrl: null } : {}),
  }, "settings.store");
  return { ok: true, message: "Dados da loja salvos." };
}

const hoursSchema = z.array(z.object({ days: z.string().trim().min(2).max(40), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) })).max(7);

export async function saveShippingAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireAdmin();
  const originCep = onlyDigits(str(form, "originCep"));
  if (originCep && !isValidCEP(originCep)) return { fieldErrors: { originCep: "CEP de origem inválido." } };
  const intOrNull = (k: string) => { const v = str(form, k); return v ? Math.max(1, Math.floor(Number(v))) : null; };
  const services = form.getAll("services").map(String).filter((s) => /^\d+$/.test(s));
  const free = str(form, "freeShippingMin");
  // Retirada
  const state = str(form, "storeState").toUpperCase();
  if (state && !(UFS as readonly string[]).includes(state)) return { fieldErrors: { storeState: "UF inválida." } };
  const rows: { days: string; open: string; close: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const days = str(form, `h${i}days`), open = str(form, `h${i}open`), close = str(form, `h${i}close`);
    if (days || open || close) rows.push({ days, open, close });
  }
  const hours = hoursSchema.safeParse(rows);
  if (!hours.success) return { fieldErrors: { hours: "Revise os horários: dia e horários no formato 09:00." } };
  const pickupEnabled = form.get("pickupEnabled") === "on";
  if (pickupEnabled && !(str(form, "storeStreet") && str(form, "storeNumber") && str(form, "storeCity") && state)) {
    return { fieldErrors: { pickupEnabled: "Para ativar a retirada, preencha rua, número, cidade e UF da loja." } };
  }
  await updateSettings(user.id, {
    originCep: originCep || null,
    defaultWeightGrams: intOrNull("defaultWeightGrams"), defaultLengthCm: intOrNull("defaultLengthCm"),
    defaultWidthCm: intOrNull("defaultWidthCm"), defaultHeightCm: intOrNull("defaultHeightCm"),
    enabledShippingServices: services,
    freeShippingMinCents: free ? parseBRLToCents(free) : null,
    pickupEnabled, storeStreet: str(form, "storeStreet") || null, storeNumber: str(form, "storeNumber") || null,
    storeComplement: str(form, "storeComplement") || null, storeNeighborhood: str(form, "storeNeighborhood") || null,
    storeCity: str(form, "storeCity") || null, storeState: state || null, storeCep: onlyDigits(str(form, "storeCep")) || null,
    openingHours: hours.data, pickupInstructions: str(form, "pickupInstructions").slice(0, 400) || null,
  }, "settings.shipping");
  return { ok: true, message: "Frete e retirada salvos." };
}

export async function savePaymentSettingsAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireAdmin();
  const max = Math.min(12, Math.max(1, Number(str(form, "maxInstallments")) || 1));
  const free = Math.min(max, Math.max(1, Number(str(form, "installmentsWithoutInterest")) || 1));
  const pix = Math.min(1440, Math.max(10, Number(str(form, "pixExpirationMinutes")) || 30));
  await updateSettings(user.id, { maxInstallments: max, installmentsWithoutInterest: free, pixExpirationMinutes: pix }, "settings.payment");
  return { ok: true, message: "Pagamento salvo." };
}

export async function saveTextsAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireAdmin();
  const t = (k: string) => str(form, k).slice(0, 20000) || null;
  await updateSettings(user.id, {
    aboutText: t("aboutText"), shippingPolicy: t("shippingPolicy"), returnsPolicy: t("returnsPolicy"),
    privacyPolicy: t("privacyPolicy"), termsOfUse: t("termsOfUse"), sizeGuide: t("sizeGuide"),
  }, "settings.texts");
  return { ok: true, message: "Textos salvos." };
}

// ───────────── Equipe ─────────────

export async function createStaffAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const name = str(form, "displayName");
  const password = String(form.get("password") ?? "");
  const role = str(form, "role") === "ADMIN" ? "ADMIN" : "STAFF";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { fieldErrors: { email: "E-mail inválido." } };
  if (name.length < 2) return { fieldErrors: { displayName: "Informe o nome." } };
  if (password.length < 12) return { fieldErrors: { password: "Use pelo menos 12 caracteres para contas do painel." } };
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return { fieldErrors: { email: "Já existe uma conta com este e-mail." } };
  const created = await db.user.create({ data: { email, role, passwordHash: await hashPassword(password), admin: { create: { displayName: name } } } });
  await audit({ actorId: user.id, action: "staff.create", entityType: "User", entityId: created.id, after: { email, role } });
  revalidatePath("/admin/configuracoes");
  return { ok: true, message: "Acesso criado." };
}

export async function removeStaffAction(userId: string): Promise<AdminState> {
  const user = await requireAdmin();
  if (userId === user.id) return { error: "Você não pode remover o próprio acesso." };
  const admins = await db.user.count({ where: { role: "ADMIN" } });
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "ADMIN" && admins <= 1) return { error: "A loja precisa de pelo menos um administrador." };
  await db.user.delete({ where: { id: userId } });
  await audit({ actorId: user.id, action: "staff.remove", entityType: "User", entityId: userId, before: { email: target.email } });
  revalidatePath("/admin/configuracoes");
  return { ok: true, message: "Acesso removido." };
}
