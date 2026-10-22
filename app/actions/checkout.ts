"use server";

import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { isValidCEP, isValidCPF, isValidPhoneBR, onlyDigits, UFS } from "@/lib/br";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { db } from "@/lib/db";
import { orderLink, verifyOrderToken } from "@/lib/order-token";
import { readCart, summarizeCart } from "@/server/cart";
import { clearCart, createOrderFromCart } from "@/server/orders";
import { getSettings } from "@/server/settings";
import { payWithCard, payWithPix, refreshPayment } from "@/server/payments";

const checkoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    fullName: z.string().trim().min(5, "Informe nome e sobrenome.").max(120).refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
    email: z.string().trim().toLowerCase().email("Confira o e-mail.").max(160),
    cpf: z.string().transform(onlyDigits).refine(isValidCPF, "CPF inválido. Confira os números."),
    phone: z.string().transform(onlyDigits).refine(isValidPhoneBR, "Telefone com DDD, só números."),
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    cep: z.string().optional(),
    street: z.string().trim().max(160).optional(),
    number: z.string().trim().max(20).optional(),
    complement: z.string().trim().max(80).optional(),
    neighborhood: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().toUpperCase().optional(),
    reference: z.string().trim().max(160).optional(),
    shippingQuoteId: z.string().max(40).optional(),
    note: z.string().trim().max(500).optional(),
    acceptTerms: z.literal(true, { message: "Aceite os termos para continuar." }),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment !== "DELIVERY") return;
    if (!v.cep || !isValidCEP(v.cep)) ctx.addIssue({ code: "custom", path: ["cep"], message: "CEP inválido." });
    if (!v.street) ctx.addIssue({ code: "custom", path: ["street"], message: "Informe a rua." });
    if (!v.number) ctx.addIssue({ code: "custom", path: ["number"], message: "Informe o número (ou “s/n”)." });
    if (!v.neighborhood) ctx.addIssue({ code: "custom", path: ["neighborhood"], message: "Informe o bairro." });
    if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Informe a cidade." });
    if (!v.state || !(UFS as readonly string[]).includes(v.state)) ctx.addIssue({ code: "custom", path: ["state"], message: "Escolha o estado." });
    if (!v.shippingQuoteId) ctx.addIssue({ code: "custom", path: ["shippingQuoteId"], message: "Escolha uma opção de frete." });
  });

export type CheckoutState =
  | { ok: true; orderId: string; payUrl: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createOrderAction(input: unknown): Promise<CheckoutState> {
  if (!(await rateLimit(`checkout:${await clientIp()}`, 12, 600))) return { ok: false, error: "Muitas tentativas seguidas. Aguarde alguns minutos." };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Revise os campos destacados.", fieldErrors };
  }
  const d = parsed.data;
  const settings = await getSettings();
  if (d.fulfillment === "PICKUP" && !settings.pickupAvailable) return { ok: false, error: "A retirada na loja não está disponível no momento." };

  const user = await currentUser();
  const cart = summarizeCart(await readCart());
  const res = await createOrderFromCart(cart, {
    idempotencyKey: d.idempotencyKey,
    customer: { fullName: d.fullName, email: user?.email ?? d.email, cpf: d.cpf, phone: d.phone, userId: user?.id, customerId: user?.customer?.id },
    fulfillment: d.fulfillment,
    address:
      d.fulfillment === "DELIVERY"
        ? { recipient: d.fullName, cep: d.cep!, street: d.street!, number: d.number!, complement: d.complement, neighborhood: d.neighborhood!, city: d.city!, state: d.state!, reference: d.reference }
        : undefined,
    shippingQuoteId: d.fulfillment === "DELIVERY" ? d.shippingQuoteId : null,
    couponCode: cart.couponCode,
    note: d.note,
  });
  if (!res.ok) return { ok: false, error: res.error };
  if (!res.existing && cart.cartId) await clearCart(cart.cartId);
  return { ok: true, orderId: res.orderId, payUrl: orderLink("/checkout/pagamento", res.orderId) };
}

async function guard(orderId: string, token: string) {
  const id = z.string().min(1).max(40).parse(orderId);
  if (!verifyOrderToken(id, token)) throw new Error("Link do pedido inválido.");
  return id;
}

export async function payPixAction(orderId: string, token: string) {
  const id = await guard(orderId, token);
  const r = await payWithPix(id);
  return r.ok ? { ok: true as const, url: orderLink("/checkout/pendente", id) } : r;
}

const cardSchema = z.object({
  token: z.string().min(10).max(200),
  payment_method_id: z.string().min(2).max(40),
  issuer_id: z.union([z.string(), z.number()]).optional().nullable(),
  installments: z.coerce.number().int().min(1).max(24),
});

export async function payCardAction(orderId: string, token: string, data: unknown, attemptKey: string) {
  const id = await guard(orderId, token);
  if (!(await rateLimit(`card:${id}`, 6, 900))) return { ok: false as const, error: "Muitas tentativas neste pedido. Pague com Pix ou aguarde 15 minutos." };
  const c = cardSchema.safeParse(data);
  if (!c.success) return { ok: false as const, error: "Dados do cartão incompletos." };
  const r = await payWithCard(id, {
    token: c.data.token, paymentMethodId: c.data.payment_method_id, issuerId: c.data.issuer_id ? String(c.data.issuer_id) : null,
    installments: c.data.installments, attemptKey: z.string().max(60).parse(attemptKey),
  });
  if (!r.ok) return r;
  return { ok: true as const, url: orderLink(r.status === "approved" ? "/checkout/sucesso" : "/checkout/pendente", id) };
}

/** Situação do pedido para a página de espera (consulta o provedor se ainda pendente). */
export async function orderStatusAction(orderId: string, token: string) {
  const id = await guard(orderId, token);
  const pending = await db.payment.findFirst({ where: { orderId: id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
  if (pending) await refreshPayment(pending.id).catch(() => null);
  const order = await db.order.findUniqueOrThrow({ where: { id }, select: { status: true, paidAt: true } });
  return { status: order.status, paid: !!order.paidAt };
}
