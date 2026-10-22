"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseBRLToCents } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { adjustStock } from "@/server/inventory";
import { deleteStoredImage, storeImage, UploadError } from "@/server/storage";

export type AdminState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const optInt = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(1_000_000).nullable());
const money = z.preprocess((v) => (v === "" || v == null ? null : parseBRLToCents(String(v))), z.number().int().min(0).nullable());

const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(140),
  slug: z.string().trim().max(90).optional(),
  description: z.string().trim().max(5000).optional(),
  composition: z.string().trim().max(300).optional(),
  careNotes: z.string().trim().max(1000).optional(),
  categoryId: z.string().optional(),
  priceCents: money,
  compareAtCents: money,
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  isFeatured: z.boolean(),
  featuredPosition: optInt,
  weightGrams: optInt,
  lengthCm: optInt,
  widthCm: optInt,
  heightCm: optInt,
  sourceUrl: z.string().trim().url("Link inválido.").max(400).optional().or(z.literal("")),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(170).optional(),
  collectionIds: z.array(z.string()),
});

function readProduct(form: FormData) {
  const get = (k: string) => (form.get(k) as string | null) ?? undefined;
  return productSchema.safeParse({
    name: get("name"), slug: get("slug"), description: get("description"), composition: get("composition"),
    careNotes: get("careNotes"), categoryId: get("categoryId") || undefined, priceCents: get("price"), compareAtCents: get("compareAt"),
    status: get("status") ?? "DRAFT", isFeatured: form.get("isFeatured") === "on", featuredPosition: get("featuredPosition"),
    weightGrams: get("weightGrams"), lengthCm: get("lengthCm"), widthCm: get("widthCm"), heightCm: get("heightCm"),
    sourceUrl: get("sourceUrl"), seoTitle: get("seoTitle"), seoDescription: get("seoDescription"),
    collectionIds: form.getAll("collectionIds").map(String),
  });
}

async function uniqueSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || "produto";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === ignoreId) return slug;
    slug = `${root}-${i}`;
  }
}

/** Publicar exige preço, ao menos uma variante ativa e uma foto. */
async function publishProblems(productId: string, priceCents: number | null) {
  const problems: string[] = [];
  if (priceCents == null) problems.push("defina o preço");
  const [variants, images] = await Promise.all([
    db.productVariant.count({ where: { productId, isActive: true } }),
    db.productImage.count({ where: { productId } }),
  ]);
  if (variants === 0) problems.push("cadastre pelo menos uma variante (cor/tamanho)");
  if (images === 0) problems.push("envie pelo menos uma foto");
  return problems;
}

export async function saveProductAction(productId: string | null, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const parsed = readProduct(form);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { error: "Revise os campos destacados.", fieldErrors: fe };
  }
  const d = parsed.data;
  if (d.compareAtCents != null && d.priceCents != null && d.compareAtCents <= d.priceCents) {
    return { fieldErrors: { compareAtCents: "O preço “de” precisa ser maior que o preço atual." } };
  }
  const slug = await uniqueSlug(d.slug || d.name, productId ?? undefined);
  const data: Prisma.ProductUncheckedUpdateInput = {
    name: d.name, slug, description: d.description || null, composition: d.composition || null, careNotes: d.careNotes || null,
    categoryId: d.categoryId || null, priceCents: d.priceCents, compareAtCents: d.compareAtCents, isFeatured: d.isFeatured,
    featuredPosition: d.featuredPosition ?? 0, weightGrams: d.weightGrams, lengthCm: d.lengthCm, widthCm: d.widthCm, heightCm: d.heightCm,
    sourceUrl: d.sourceUrl || null, seoTitle: d.seoTitle || null, seoDescription: d.seoDescription || null,
  };

  let id = productId;
  let message = "Produto salvo.";
  if (!id) {
    const created = await db.product.create({ data: { ...(data as Prisma.ProductUncheckedCreateInput), status: "DRAFT" } });
    id = created.id;
    await audit({ actorId: user.id, action: "product.create", entityType: "Product", entityId: id, after: { name: d.name } });
  } else {
    const before = await db.product.findUniqueOrThrow({ where: { id } });
    let status = d.status;
    if (status === "ACTIVE" && before.status !== "ACTIVE") {
      const problems = await publishProblems(id, d.priceCents);
      if (problems.length) {
        status = before.status === "ARCHIVED" ? "ARCHIVED" : "DRAFT";
        message = `Salvo como rascunho. Para publicar, ${problems.join(", ")}.`;
      }
    }
    await db.product.update({
      where: { id },
      data: { ...data, status, publishedAt: status === "ACTIVE" ? before.publishedAt ?? new Date() : before.publishedAt },
    });
    await audit({ actorId: user.id, action: "product.update", entityType: "Product", entityId: id, before: { name: before.name, status: before.status, priceCents: before.priceCents }, after: { name: d.name, status, priceCents: d.priceCents } });
  }

  await db.collectionProduct.deleteMany({ where: { productId: id, collectionId: { notIn: d.collectionIds } } });
  for (const cid of d.collectionIds) {
    await db.collectionProduct.upsert({ where: { collectionId_productId: { collectionId: cid, productId: id } }, update: {}, create: { collectionId: cid, productId: id } });
  }

  revalidatePath("/admin/produtos");
  if (!productId) redirect(`/admin/produtos/${id}?novo=1`);
  return { ok: true, message };
}

export async function archiveProductAction(productId: string) {
  const user = await requireStaff();
  await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED", isFeatured: false } });
  await audit({ actorId: user.id, action: "product.archive", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos");
}

/** Exclusão definitiva só para produtos que nunca foram vendidos; os outros são arquivados. */
export async function deleteProductAction(productId: string): Promise<AdminState> {
  const user = await requireAdmin();
  const sold = await db.orderItem.count({ where: { variant: { productId } } });
  if (sold > 0) return { error: "Este produto já tem pedidos e não pode ser excluído. Arquive-o para tirá-lo da loja." };
  const images = await db.productImage.findMany({ where: { productId }, select: { url: true } });
  await db.product.delete({ where: { id: productId } });
  await Promise.all(images.map((i) => deleteStoredImage(i.url)));
  await audit({ actorId: user.id, action: "product.delete", entityType: "Product", entityId: productId });
  revalidatePath("/admin/produtos");
  redirect("/admin/produtos");
}

// ───────────── Fotos ─────────────

export async function uploadImagesAction(productId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Escolha pelo menos uma foto." };
  if (files.length > 20) return { error: "Envie até 20 fotos por vez." };
  const kind = form.get("kind") === "editorial" ? "editorial" : "product";
  const colorName = String(form.get("colorName") ?? "").trim() || null;
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { name: true, slug: true } });
  let position = (await db.productImage.aggregate({ where: { productId }, _max: { position: true } }))._max.position ?? -1;
  const errors: string[] = [];
  for (const file of files) {
    try {
      const img = await storeImage(file, `produtos/${product.slug}`.replace("/", "-"));
      position += 1;
      await db.productImage.create({
        data: {
          productId, url: img.url, width: img.width, height: img.height, kind, colorName, position,
          alt: `${product.name}${colorName ? `, cor ${colorName}` : ""}`,
        },
      });
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof UploadError ? e.message : "falha ao processar"}`);
    }
  }
  await audit({ actorId: user.id, action: "product.images.upload", entityType: "Product", entityId: productId, after: { count: files.length - errors.length } });
  revalidatePath(`/admin/produtos/${productId}`);
  return errors.length ? { error: errors.join(" · ") } : { ok: true, message: `${files.length} ${files.length === 1 ? "foto enviada" : "fotos enviadas"}.` };
}

const imageMeta = z.object({
  alt: z.string().trim().min(3, "Descreva a foto.").max(200),
  colorName: z.string().trim().max(40),
  kind: z.enum(["product", "editorial"]),
  needsBetterPhoto: z.boolean(),
});

export async function updateImageAction(imageId: string, form: FormData) {
  await requireStaff();
  const d = imageMeta.parse({ alt: form.get("alt"), colorName: form.get("colorName") ?? "", kind: form.get("kind"), needsBetterPhoto: form.get("needsBetterPhoto") === "on" });
  const img = await db.productImage.update({ where: { id: imageId }, data: { ...d, colorName: d.colorName || null } });
  revalidatePath(`/admin/produtos/${img.productId}`);
}

export async function moveImageAction(imageId: string, dir: -1 | 1) {
  await requireStaff();
  const img = await db.productImage.findUniqueOrThrow({ where: { id: imageId } });
  const all = await db.productImage.findMany({ where: { productId: img.productId }, orderBy: { position: "asc" } });
  const i = all.findIndex((x) => x.id === imageId);
  const j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.$transaction(all.map((x, k) => db.productImage.update({ where: { id: x.id }, data: { position: k } })));
  revalidatePath(`/admin/produtos/${img.productId}`);
}

export async function deleteImageAction(imageId: string) {
  const user = await requireStaff();
  const img = await db.productImage.delete({ where: { id: imageId } });
  await deleteStoredImage(img.url);
  await audit({ actorId: user.id, action: "product.images.delete", entityType: "Product", entityId: img.productId });
  revalidatePath(`/admin/produtos/${img.productId}`);
}

// ───────────── Variantes ─────────────

const variantSchema = z.object({
  colorName: z.string().trim().max(40),
  colorHex: z.string().trim().regex(/^(#[0-9a-fA-F]{6})?$/, "Cor em hexadecimal, ex.: #1A1A1A"),
  size: z.string().trim().max(12),
  sku: z.string().trim().max(60),
  price: money,
  lowStockAt: optInt,
});

function makeSku(slug: string, color: string, size: string) {
  return [slug.slice(0, 24), slugify(color).slice(0, 10), slugify(size)].filter(Boolean).join("-").toUpperCase();
}

/** Cria variantes em lote a partir de cores × tamanhos. Estoque inicial entra como movimento. */
export async function generateVariantsAction(productId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const colors = String(form.get("colors") ?? "").split(/[\n,;]/).map((c) => c.trim()).filter(Boolean);
  const sizes = String(form.get("sizes") ?? "").split(/[\s,;/]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  const initial = Math.max(0, Math.min(9999, Number(form.get("initialStock") ?? 0) || 0));
  if (!colors.length && !sizes.length) return { error: "Informe as cores, os tamanhos, ou ambos." };
  const colorList = colors.length ? colors : [""];
  const sizeList = sizes.length ? sizes : [""];
  let created = 0;
  for (const raw of colorList) {
    const [name, hex] = raw.split("|").map((x) => x?.trim());
    for (const size of sizeList) {
      const exists = await db.productVariant.findFirst({ where: { productId, colorName: name || null, size: size || null } });
      if (exists) continue;
      let sku = makeSku(product.slug, name ?? "", size);
      if (await db.productVariant.findUnique({ where: { sku } })) sku = `${sku}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await db.$transaction(async (tx) => {
        const v = await tx.productVariant.create({
          data: { productId, colorName: name || null, colorHex: hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null, size: size || null, sku, stock: 0 },
        });
        if (initial > 0) await adjustStock(tx, { variantId: v.id, delta: initial, reason: "RESTOCK", actorId: user.id, note: "Estoque inicial" });
      });
      created++;
    }
  }
  await audit({ actorId: user.id, action: "variant.generate", entityType: "Product", entityId: productId, after: { created } });
  revalidatePath(`/admin/produtos/${productId}`);
  return { ok: true, message: created ? `${created} ${created === 1 ? "variante criada" : "variantes criadas"}.` : "Essas combinações já existiam." };
}

export async function updateVariantAction(variantId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const parsed = variantSchema.safeParse({
    colorName: form.get("colorName") ?? "", colorHex: form.get("colorHex") ?? "", size: form.get("size") ?? "",
    sku: form.get("sku") ?? "", price: form.get("price"), lowStockAt: form.get("lowStockAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const v = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  try {
    await db.productVariant.update({
      where: { id: variantId },
      data: {
        colorName: d.colorName || null, colorHex: d.colorHex || null, size: d.size.toUpperCase() || null, sku: d.sku || v.sku,
        priceCents: d.price, lowStockAt: d.lowStockAt ?? v.lowStockAt, isActive: form.get("isActive") === "on",
      },
    });
  } catch (e) {
    if ((e as Prisma.PrismaClientKnownRequestError).code === "P2002") return { error: "Já existe uma variante com esse SKU ou com essa cor e tamanho." };
    throw e;
  }
  await audit({ actorId: user.id, action: "variant.update", entityType: "ProductVariant", entityId: variantId, before: { sku: v.sku, priceCents: v.priceCents, isActive: v.isActive }, after: d });
  revalidatePath(`/admin/produtos/${v.productId}`);
  return { ok: true, message: "Variante salva." };
}

export async function deleteVariantAction(variantId: string): Promise<AdminState> {
  const user = await requireStaff();
  const v = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const sold = await db.orderItem.count({ where: { variantId } });
  if (sold > 0) {
    await db.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
    revalidatePath(`/admin/produtos/${v.productId}`);
    return { ok: true, message: "Esta variante já foi vendida, então foi desativada em vez de excluída." };
  }
  await db.productVariant.delete({ where: { id: variantId } });
  await audit({ actorId: user.id, action: "variant.delete", entityType: "ProductVariant", entityId: variantId, before: { sku: v.sku } });
  revalidatePath(`/admin/produtos/${v.productId}`);
  return { ok: true, message: "Variante excluída." };
}

// ───────────── Estoque ─────────────

const stockSchema = z.object({
  delta: z.coerce.number().int().min(-9999).max(9999).refine((n) => n !== 0, "Informe uma quantidade diferente de zero."),
  reason: z.enum(["RESTOCK", "ADJUSTMENT", "RETURN"]),
  note: z.string().trim().max(200).optional(),
});

export async function adjustStockAction(variantId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const user = await requireStaff();
  const parsed = stockSchema.safeParse({ delta: form.get("delta"), reason: form.get("reason"), note: form.get("note") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  if (v.stock + parsed.data.delta < v.reserved) return { error: `Há ${v.reserved} unidades reservadas em pedidos aguardando pagamento. O estoque não pode ficar abaixo disso.` };
  const after = await db.$transaction((tx) => adjustStock(tx, { variantId, delta: parsed.data.delta, reason: parsed.data.reason, actorId: user.id, note: parsed.data.note }));
  revalidatePath("/admin/estoque");
  revalidatePath(`/admin/produtos/${v.productId}`);
  return { ok: true, message: `Estoque atualizado: ${after} un.` };
}
