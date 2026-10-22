import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Link assinado para a cliente acompanhar o pedido sem precisar de conta. */
function secret() {
  const s = process.env.ORDER_LINK_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("ORDER_LINK_SECRET não configurado");
  return s ?? "dev-only-order-secret";
}

export function signOrder(orderId: string) {
  return createHmac("sha256", secret()).update(`order:${orderId}`).digest("base64url").slice(0, 32);
}

export function verifyOrderToken(orderId: string, token: string | null | undefined) {
  if (!token) return false;
  const expected = signOrder(orderId);
  return expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function orderLink(path: "/checkout/sucesso" | "/checkout/pendente" | "/checkout/falha" | "/checkout/pagamento" | "/pedido", orderId: string) {
  return `${path}?pedido=${orderId}&t=${signOrder(orderId)}`;
}
