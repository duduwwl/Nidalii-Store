import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapStatus, verifyWebhookSignature } from "@/server/payments/mercadopago";
import { computeDiscount } from "@/server/coupons";
import { canTransition } from "@/server/orders";

const secret = "segredo-de-teste";
function sign(dataId: string, requestId: string, ts: number) {
  const v1 = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("assinatura do webhook do Mercado Pago", () => {
  const ts = Math.floor(Date.now() / 1000);
  it("aceita assinatura correta", () => {
    expect(verifyWebhookSignature({ xSignature: sign("123", "req-1", ts), xRequestId: "req-1", dataId: "123", secret, toleranceSeconds: 600 })).toBe(true);
  });
  it("recusa assinatura de outro pagamento, segredo errado, sem cabeçalho ou antiga", () => {
    expect(verifyWebhookSignature({ xSignature: sign("123", "req-1", ts), xRequestId: "req-1", dataId: "999", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: sign("123", "req-1", ts), xRequestId: "req-1", dataId: "123", secret: "outro" })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: null, xRequestId: "req-1", dataId: "123", secret })).toBe(false);
    expect(verifyWebhookSignature({ xSignature: sign("123", "req-1", ts - 3600), xRequestId: "req-1", dataId: "123", secret, toleranceSeconds: 600 })).toBe(false);
  });
  it("mapeia status do provedor", () => {
    expect(mapStatus("approved").outcome).toBe("APPROVED");
    expect(mapStatus("in_process").outcome).toBe("PENDING");
    expect(mapStatus("rejected").outcome).toBe("REJECTED");
  });
});

describe("cupons e pedidos", () => {
  it("desconto nunca passa do subtotal", () => {
    expect(computeDiscount({ type: "PERCENT", value: 10 }, 15000)).toBe(1500);
    expect(computeDiscount({ type: "FIXED", value: 9000 }, 5000)).toBe(5000);
  });
  it("transições de status", () => {
    expect(canTransition("AWAITING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("CANCELED", "PAID")).toBe(false);
    expect(canTransition("DELIVERED", "SHIPPED")).toBe(false);
    expect(canTransition("PREPARING", "READY_FOR_PICKUP")).toBe(true);
  });
});
