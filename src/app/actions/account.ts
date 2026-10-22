"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser, destroySession, hashPassword, requireCustomer, signIn } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { isValidCEP, isValidCPF, isValidPhoneBR, onlyDigits, UFS } from "@/lib/br";
import { mergeGuestCart } from "@/server/cart";
import { sendPasswordReset } from "@/server/email";

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string } | null;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/admin") ? s : "/minha-conta";
};
const fieldErrors = (e: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
};

const password = z.string().min(8, "Use pelo menos 8 caracteres.").max(128);

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 10, 900))) return { error: "Muitas tentativas. Tente de novo em 15 minutos." };
  const email = String(form.get("email") ?? "");
  const res = await signIn(email, String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  const user = await currentUserAfterLogin(email);
  if (user?.customer) await mergeGuestCart(user.customer.id);
  redirect(safeNext(form.get("voltar")));
}

async function currentUserAfterLogin(email: string) {
  return db.user.findUnique({ where: { email: email.toLowerCase().trim() }, include: { customer: true } });
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(5, "Informe nome e sobrenome.").max(120),
  email: z.string().trim().toLowerCase().email("Confira o e-mail.").max(160),
  password,
  marketing: z.boolean(),
  terms: z.literal(true, { message: "Aceite os termos para criar a conta." }),
});

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit(`signup:${await clientIp()}`, 5, 3600))) return { error: "Muitas contas criadas daqui. Tente mais tarde." };
  const parsed = signUpSchema.safeParse({
    fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"),
    marketing: form.get("marketing") === "on", terms: form.get("terms") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Revise os campos." };
  const d = parsed.data;
  const exists = await db.user.findUnique({ where: { email: d.email } });
  if (exists) return { fieldErrors: { email: "Já existe uma conta com este e-mail. Entre ou redefina a senha." } };
  const user = await db.user.create({
    data: {
      email: d.email,
      passwordHash: await hashPassword(d.password),
      role: "CUSTOMER",
      // Pedidos antigos feitos como visitante não são ligados automaticamente:
      // isso só acontece depois de confirmar o e-mail, para proteger os dados de quem comprou.
      customer: { create: { email: d.email, fullName: d.fullName, marketingOptIn: d.marketing, consentAt: new Date() } },
    },
    include: { customer: true },
  });
  await signIn(d.email, d.password);
  await mergeGuestCart(user.customer!.id);
  redirect(safeNext(form.get("voltar")));
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit(`reset:${await clientIp()}`, 5, 3600))) return { error: "Muitas solicitações. Tente mais tarde." };
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  const message = "Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha.";
  if (!email.success) return { fieldErrors: { email: "Confira o e-mail." } };
  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.authToken.create({ data: { userId: user.id, kind: "reset", tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600e3) } });
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    await sendPasswordReset(user.email, `${base}/redefinir-senha?token=${token}`);
  }
  return { ok: true, message }; // mesma resposta para e-mails existentes ou não
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const pw = password.safeParse(form.get("password"));
  if (!pw.success) return { fieldErrors: { password: pw.error.issues[0].message } };
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.kind !== "reset" || row.usedAt || row.expiresAt < new Date()) return { error: "Este link expirou. Peça um novo." };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(pw.data), failedLogins: 0, lockedUntil: null } }),
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: row.userId } }), // encerra sessões antigas
  ]);
  return { ok: true, message: "Senha alterada. Entre com a nova senha." };
}

const profileSchema = z.object({
  fullName: z.string().trim().min(5, "Informe nome e sobrenome.").max(120),
  cpf: z.string().transform(onlyDigits).refine((v) => !v || isValidCPF(v), "CPF inválido."),
  phone: z.string().transform(onlyDigits).refine((v) => !v || isValidPhoneBR(v), "Telefone com DDD."),
  marketing: z.boolean(),
});

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireCustomer();
  const parsed = profileSchema.safeParse({ fullName: form.get("fullName"), cpf: form.get("cpf") ?? "", phone: form.get("phone") ?? "", marketing: form.get("marketing") === "on" });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  await db.customer.update({
    where: { id: user.customer!.id },
    data: { fullName: parsed.data.fullName, cpf: parsed.data.cpf || null, phone: parsed.data.phone || null, marketingOptIn: parsed.data.marketing },
  });
  revalidatePath("/minha-conta");
  return { ok: true, message: "Dados salvos." };
}

const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(40).optional(),
  recipient: z.string().trim().min(3, "Informe quem recebe.").max(120),
  cep: z.string().transform(onlyDigits).refine(isValidCEP, "CEP inválido."),
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(100),
  city: z.string().trim().min(2, "Informe a cidade.").max(100),
  state: z.string().toUpperCase().refine((v) => (UFS as readonly string[]).includes(v), "Escolha o estado."),
  reference: z.string().trim().max(160).optional(),
  isDefault: z.boolean(),
});

export async function saveAddressAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireCustomer("/minha-conta/enderecos");
  const raw = Object.fromEntries(form.entries());
  const parsed = addressSchema.safeParse({ ...raw, isDefault: form.get("isDefault") === "on", id: raw.id || undefined });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { id, ...data } = parsed.data;
  const customerId = user.customer!.id;
  if (data.isDefault) await db.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  if (id) {
    const own = await db.address.findFirst({ where: { id, customerId } });
    if (!own) return { error: "Endereço não encontrado." };
    await db.address.update({ where: { id }, data: { ...data, complement: data.complement || null, reference: data.reference || null, label: data.label || null } });
  } else {
    const count = await db.address.count({ where: { customerId } });
    await db.address.create({ data: { ...data, customerId, isDefault: data.isDefault || count === 0, complement: data.complement || null, reference: data.reference || null, label: data.label || null } });
  }
  revalidatePath("/minha-conta/enderecos");
  return { ok: true, message: "Endereço salvo." };
}

export async function deleteAddressAction(id: string) {
  const user = await requireCustomer("/minha-conta/enderecos");
  await db.address.deleteMany({ where: { id, customerId: user.customer!.id } });
  revalidatePath("/minha-conta/enderecos");
}

/** Exclusão de conta (LGPD): remove dados pessoais e mantém pedidos anonimizados por obrigação fiscal. */
export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user?.customer) redirect("/entrar");
  if (form.get("confirm") !== "EXCLUIR") return { fieldErrors: { confirm: "Digite EXCLUIR para confirmar." } };
  await db.$transaction([
    db.address.deleteMany({ where: { customerId: user.customer.id } }),
    db.customer.update({ where: { id: user.customer.id }, data: { fullName: "Cliente removida", email: `removida+${user.customer.id}@invalid`, cpf: null, phone: null, userId: null, marketingOptIn: false } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await destroySession();
  redirect("/");
}
