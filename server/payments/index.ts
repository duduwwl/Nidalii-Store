import "server-only";
import { after } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { applyPaymentOutcome, reopenForPayment } from "../orders";
import { getSettings } from "../settings";
import { sendOrderPaid } from "../email";
import * as MP from "./mercadopago";

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? full, lastName: parts.slice(1).join(" ") || parts[0] || full };
}

async function loadOrder(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true } });
}

function payerFor(order: Awaited<ReturnType<typeof loadOrder>>) {
  return { email: order.customer.email, cpf: order.customer.cpf ?? "", ...splitName(order.customer.fullName) };
}

export type PayResult =
  | { ok: true; status: "approved" | "pending" | "pix"; paymentId: string }
  | { ok: false; error: string };

/** Atualiza o registro local com o que o provedor informou e aplica no pedido. */
export async function syncFromProvider(mp: MP.MpPayment) {
  const orderId = mp.external_reference;
  if (!orderId) return null;
  const mapped = MP.mapStatus(mp.status);
  const method: PaymentMethod =
    mp.payment_method_id === "pix" ? "PIX" : mp.payment_type_id === "debit_card" ? "DEBIT_CARD" : "CREDIT_CARD";
  const total = Math.round((mp.transaction_details?.total_paid_amount ?? mp.transaction_amount) * 100);
  const base = Math.round(mp.transaction_amount * 100);
  const payment = await db.payment.upsert({
    where: { providerPaymentId: String(mp.id) },
    update: { status: mapped.payment, statusDetail: mp.status_detail ?? null },
    create: {
      orderId,
      provider: "mercadopago",
      providerPaymentId: String(mp.id),
      method,
      status: mapped.payment,
      amountCents: base,
      installments: mp.installments ?? 1,
      interestCents: Math.max(0, total - base),
      cardLastFour: mp.card?.last_four_digits ?? null,
      statusDetail: mp.status_detail ?? null,
      pixQrCode: mp.point_of_interaction?.transaction_data?.qr_code ?? null,
      pixQrCodeBase64: mp.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      pixExpiresAt: mp.date_of_expiration ? new Date(mp.date_of_expiration) : null,
    },
  });
  const before = await db.order.findUnique({ where: { id: orderId }, select: { paidAt: true } });
  const updated = await applyPaymentOutcome(orderId, mapped.outcome);
  if (!before?.paidAt && updated.paidAt) {
    // e-mail depois da resposta; falha no envio não desfaz o pagamento
    after(() => sendOrderPaid(orderId).catch((e) => console.error("[e-mail]", e)));
  }
  return payment;
}

export async function payWithPix(orderId: string): Promise<PayResult> {
  if (!MP.mpConfigured()) return { ok: false, error: "O pagamento online ainda não foi configurado pela loja." };
  const order = await loadOrder(orderId);
  if (order.status !== "AWAITING_PAYMENT" && order.status !== "PAYMENT_FAILED") {
    return { ok: false, error: "Este pedido não aceita mais pagamento." };
  }
  // Reaproveita um Pix ainda válido em vez de gerar outro
  const open = await db.payment.findFirst({
    where: { orderId, method: "PIX", status: "PENDING", pixExpiresAt: { gt: new Date() } },
  });
  if (open) return { ok: true, status: "pix", paymentId: open.id };
  const reopened = await reopenForPayment(orderId);
  if (!reopened.ok) return reopened;

  const s = await getSettings();
  try {
    const mp = await MP.createPixPayment({
      orderId, orderNumber: order.number, amountCents: order.totalCents, payer: payerFor(order),
      expiresInMinutes: s.pixExpirationMinutes, idempotencyKey: `${order.idempotencyKey}:pix:${Math.floor(Date.now() / 6e5)}`,
    });
    const payment = await syncFromProvider(mp);
    if (!payment) return { ok: false, error: "Não foi possível gerar o Pix." };
    return { ok: true, status: "pix", paymentId: payment.id };
  } catch (e) {
    console.error("[pix]", e);
    return { ok: false, error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." };
  }
}

export async function payWithCard(
  orderId: string,
  p: { token: string; paymentMethodId: string; issuerId?: string | null; installments: number; attemptKey: string },
): Promise<PayResult> {
  if (!MP.mpConfigured()) return { ok: false, error: "O pagamento online ainda não foi configurado pela loja." };
  const order = await loadOrder(orderId);
  if (order.status !== "AWAITING_PAYMENT" && order.status !== "PAYMENT_FAILED") {
    return { ok: false, error: "Este pedido não aceita mais pagamento." };
  }
  const reopened = await reopenForPayment(orderId);
  if (!reopened.ok) return reopened;
  const s = await getSettings();
  const installments = Math.min(Math.max(1, Math.floor(p.installments)), Math.max(1, s.maxInstallments));
  try {
    const mp = await MP.createCardPayment({
      orderId, orderNumber: order.number, amountCents: order.totalCents, payer: payerFor(order),
      token: p.token, paymentMethodId: p.paymentMethodId, issuerId: p.issuerId, installments,
      idempotencyKey: `${order.idempotencyKey}:card:${p.attemptKey}`,
    });
    const payment = await syncFromProvider(mp);
    if (!payment) return { ok: false, error: "Não foi possível registrar o pagamento." };
    if (mp.status === "approved") return { ok: true, status: "approved", paymentId: payment.id };
    if (mp.status === "rejected" || mp.status === "cancelled") return { ok: false, error: MP.rejectionMessage(mp.status_detail) };
    return { ok: true, status: "pending", paymentId: payment.id };
  } catch (e) {
    console.error("[cartão]", e);
    return { ok: false, error: "Não foi possível processar o cartão agora. Tente de novo ou pague com Pix." };
  }
}

/** Consulta o provedor diretamente (usado na página de status e por segurança no webhook). */
export async function refreshPayment(paymentId: string) {
  const local = await db.payment.findUnique({ where: { id: paymentId } });
  if (!local?.providerPaymentId || !MP.mpConfigured()) return local;
  const mp = await MP.getPayment(local.providerPaymentId);
  return syncFromProvider(mp);
}
