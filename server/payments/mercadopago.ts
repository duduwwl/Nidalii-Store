import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";

export const mpConfigured = () => !!process.env.MP_ACCESS_TOKEN && !!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

export type MpPayment = {
  id: number;
  status: "pending" | "approved" | "authorized" | "in_process" | "in_mediation" | "rejected" | "cancelled" | "refunded" | "charged_back";
  status_detail?: string;
  external_reference?: string;
  transaction_amount: number;
  installments?: number;
  payment_method_id?: string;
  payment_type_id?: string; // "credit_card" | "debit_card" | "bank_transfer" (Pix)...
  date_of_expiration?: string;
  card?: { last_four_digits?: string };
  transaction_details?: { total_paid_amount?: number };
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
};

async function mp<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; cause?: unknown };
  if (!res.ok) {
    console.error("[mercadopago]", path, res.status, JSON.stringify(body).slice(0, 800));
    throw new MpError(res.status, body.message ?? "Erro no Mercado Pago");
  }
  return body;
}

export class MpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const baseUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Payer = { email: string; firstName: string; lastName: string; cpf: string };

function payerBody(p: Payer) {
  return {
    email: p.email,
    first_name: p.firstName,
    last_name: p.lastName,
    identification: { type: "CPF", number: p.cpf },
  };
}

function notificationUrl() {
  const url = `${baseUrl()}/api/webhooks/mercadopago`;
  // O Mercado Pago só aceita URL pública com https; em desenvolvimento local, não envia
  return url.startsWith("https://") ? url : undefined;
}

export async function createPixPayment(p: {
  orderId: string; orderNumber: number; amountCents: number; payer: Payer; expiresInMinutes: number; idempotencyKey: string;
}) {
  const expiration = new Date(Date.now() + p.expiresInMinutes * 6e4);
  return mp<MpPayment>("/v1/payments", {
    method: "POST",
    idempotencyKey: p.idempotencyKey,
    body: JSON.stringify({
      transaction_amount: p.amountCents / 100,
      description: `Pedido ${p.orderNumber} — Nidalii Store`,
      payment_method_id: "pix",
      external_reference: p.orderId,
      notification_url: notificationUrl(),
      date_of_expiration: toMpDate(expiration),
      payer: payerBody(p.payer),
    }),
  });
}

/**
 * Cartão de crédito ou débito. O número do cartão nunca passa pelo nosso servidor:
 * o navegador gera um token no formulário seguro do Mercado Pago (Card Payment Brick).
 */
export async function createCardPayment(p: {
  orderId: string; orderNumber: number; amountCents: number; payer: Payer;
  token: string; paymentMethodId: string; issuerId?: string | null; installments: number; idempotencyKey: string;
}) {
  return mp<MpPayment>("/v1/payments", {
    method: "POST",
    idempotencyKey: p.idempotencyKey,
    body: JSON.stringify({
      transaction_amount: p.amountCents / 100,
      token: p.token,
      description: `Pedido ${p.orderNumber} — Nidalii Store`,
      installments: p.installments,
      payment_method_id: p.paymentMethodId,
      ...(p.issuerId ? { issuer_id: Number(p.issuerId) } : {}),
      external_reference: p.orderId,
      notification_url: notificationUrl(),
      statement_descriptor: "NIDALII STORE",
      three_d_secure_mode: "optional", // exigido por alguns bancos para débito
      payer: payerBody(p.payer),
    }),
  });
}

export const getPayment = (id: string | number) => mp<MpPayment>(`/v1/payments/${id}`);

export async function refundPayment(id: string | number, idempotencyKey: string) {
  return mp<{ id: number; status: string }>(`/v1/payments/${id}/refunds`, { method: "POST", body: "{}", idempotencyKey });
}

/** Valida a assinatura x-signature do webhook (HMAC-SHA256), igual ao SDK oficial. */
export function verifyWebhookSignature(p: {
  xSignature: string | null; xRequestId: string | null; dataId: string | null; secret: string; toleranceSeconds?: number;
}): boolean {
  if (!p.xSignature) return false;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of p.xSignature.split(",")) {
    const [k, ...rest] = part.split("=");
    const key = k?.trim().toLowerCase();
    const value = rest.join("=").trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
  const parts: string[] = [];
  const dataId = p.dataId?.trim().toLowerCase();
  if (dataId) parts.push(`id:${dataId}`);
  if (p.xRequestId?.trim()) parts.push(`request-id:${p.xRequestId.trim()}`);
  parts.push(`ts:${ts}`);
  const expected = createHmac("sha256", p.secret).update(parts.join(";") + ";").digest("hex");
  if (expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return false;
  if (p.toleranceSeconds != null && Math.abs(Date.now() / 1000 - Number(ts)) > p.toleranceSeconds) return false;
  return true;
}

export function mapStatus(s: MpPayment["status"]) {
  switch (s) {
    case "approved":
      return { payment: "APPROVED" as const, outcome: "APPROVED" as const };
    case "authorized":
      return { payment: "AUTHORIZED" as const, outcome: "PENDING" as const };
    case "rejected":
      return { payment: "REJECTED" as const, outcome: "REJECTED" as const };
    case "cancelled":
      return { payment: "CANCELED" as const, outcome: "REJECTED" as const };
    case "refunded":
      return { payment: "REFUNDED" as const, outcome: "REFUNDED" as const };
    case "charged_back":
      return { payment: "CHARGED_BACK" as const, outcome: "REFUNDED" as const };
    default:
      return { payment: "PENDING" as const, outcome: "PENDING" as const };
  }
}

/** Mensagens claras para os motivos de recusa mais comuns. */
export function rejectionMessage(detail?: string) {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo ou limite insuficiente. Tente outro cartão ou pague com Pix.",
    cc_rejected_bad_filled_security_code: "O código de segurança está incorreto.",
    cc_rejected_bad_filled_date: "A data de validade está incorreta.",
    cc_rejected_bad_filled_other: "Confira os dados do cartão.",
    cc_rejected_call_for_authorize: "O banco pediu autorização. Ligue para o banco e tente de novo.",
    cc_rejected_card_disabled: "O cartão está desativado. Fale com o banco ou use outro cartão.",
    cc_rejected_duplicated_payment: "Esse pagamento já foi feito. Confira seu e-mail antes de tentar de novo.",
    cc_rejected_high_risk: "O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.",
    cc_rejected_max_attempts: "Limite de tentativas atingido. Use outro cartão ou pague com Pix.",
  };
  return (detail && map[detail]) || "O pagamento foi recusado. Tente outro cartão ou pague com Pix.";
}

function toMpDate(d: Date) {
  // formato aceito: yyyy-MM-ddTHH:mm:ss.SSS-03:00
  const local = new Date(d.getTime() - 3 * 3600e3);
  return local.toISOString().replace("Z", "-03:00");
}
