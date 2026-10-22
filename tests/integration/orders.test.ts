/**
 * Fluxo de pedido contra o banco de testes (DATABASE_URL de .env.test).
 * Cria os próprios dados e apaga ao final.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { applyPaymentOutcome, changeOrderStatus, createOrderFromCart, expireStaleReservations } from "@/server/orders";
import type { CartSummary } from "@/server/cart";

if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("Rode com o banco de testes: npm run test:integration");

const db = new PrismaClient();
const tag = `it-${Date.now()}`;
let variantId = "";
let cartId = "";
let adminId = "";

function summary(quantity: number, unit = 10000): CartSummary {
  return {
    cartId, couponCode: null, count: quantity, subtotalCents: unit * quantity, hasProblems: false,
    lines: [{
      id: "l1", variantId, productId: "p", name: "Peça integração", slug: tag, sku: `${tag}-SKU`, colorName: "Preto", size: "M",
      image: null, quantity, unitCents: unit, compareAtCents: null, totalCents: unit * quantity, available: 99, problem: null,
      weightGrams: 300, dims: { l: 30, w: 20, h: 5 },
    }],
  };
}
const customer = { fullName: "Cliente Teste", email: `${tag}@exemplo.test`, cpf: "52998224725", phone: "11987654321" };
const stockOf = async () => db.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true, reserved: true } });

beforeAll(async () => {
  const p = await db.product.create({ data: { name: "Peça integração", slug: tag, status: "ACTIVE", priceCents: 10000, publishedAt: new Date() } });
  const v = await db.productVariant.create({ data: { productId: p.id, sku: `${tag}-SKU`, colorName: "Preto", size: "M", stock: 3 } });
  variantId = v.id;
  cartId = (await db.cart.create({ data: {} })).id;
  adminId = (await db.user.create({ data: { email: `${tag}-admin@exemplo.test`, role: "ADMIN" } })).id;
  await db.coupon.create({ data: { code: tag.toUpperCase(), type: "PERCENT", value: 10 } });
});

afterAll(async () => {
  const orders = await db.order.findMany({ where: { customer: { email: customer.email } }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.couponRedemption.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.customer.deleteMany({ where: { email: customer.email } });
  await db.inventoryMovement.deleteMany({ where: { variantId } });
  await db.product.deleteMany({ where: { slug: tag } });
  await db.coupon.deleteMany({ where: { code: tag.toUpperCase() } });
  await db.cart.deleteMany({ where: { id: cartId } });
  await db.user.deleteMany({ where: { id: adminId } });
  await db.$disconnect();
});

describe("pedido, estoque e pagamento", () => {
  let orderId = "";
  const key = randomUUID();

  it("cria o pedido recalculando valores e reservando estoque", async () => {
    const r = await createOrderFromCart(summary(2), { idempotencyKey: key, customer, fulfillment: "PICKUP", couponCode: tag });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    orderId = r.orderId;
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.subtotalCents).toBe(20000);
    expect(o.discountCents).toBe(2000);
    expect(o.totalCents).toBe(18000);
    expect(o.status).toBe("AWAITING_PAYMENT");
    expect(await stockOf()).toEqual({ stock: 3, reserved: 2 });
  });

  it("reenviar o mesmo checkout devolve o mesmo pedido (sem duplicar)", async () => {
    const r = await createOrderFromCart(summary(2), { idempotencyKey: key, customer, fulfillment: "PICKUP" });
    expect(r).toMatchObject({ ok: true, orderId, existing: true });
    expect(await stockOf()).toEqual({ stock: 3, reserved: 2 });
  });

  it("não vende acima do estoque disponível", async () => {
    const r = await createOrderFromCart(summary(2), { idempotencyKey: randomUUID(), customer, fulfillment: "PICKUP" });
    expect(r.ok).toBe(false);
    expect(await stockOf()).toEqual({ stock: 3, reserved: 2 });
  });

  it("entrega exige cotação de frete feita pelo servidor", async () => {
    const r = await createOrderFromCart(summary(1), {
      idempotencyKey: randomUUID(), customer, fulfillment: "DELIVERY", shippingQuoteId: "inventado",
      address: { recipient: "X", cep: "01310100", street: "Rua", number: "1", neighborhood: "B", city: "C", state: "SP" },
    });
    expect(r).toMatchObject({ ok: false });
  });

  it("aprovação do pagamento baixa o estoque uma única vez", async () => {
    await applyPaymentOutcome(orderId, "APPROVED");
    await applyPaymentOutcome(orderId, "APPROVED"); // webhook repetido
    expect(await stockOf()).toEqual({ stock: 1, reserved: 0 });
    const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(o.status).toBe("PAID");
    expect(o.paidAt).not.toBeNull();
    const c = await db.coupon.findUniqueOrThrow({ where: { code: tag.toUpperCase() } });
    expect(c.usedCount).toBe(1);
  });

  it("cancelar pedido pago devolve as peças ao estoque", async () => {
    await changeOrderStatus(orderId, "CANCELED", adminId, "teste");
    expect(await stockOf()).toEqual({ stock: 3, reserved: 0 });
    await expect(changeOrderStatus(orderId, "PREPARING", adminId)).rejects.toThrow();
  });

  it("pagamento recusado libera a reserva", async () => {
    const r = await createOrderFromCart(summary(1), { idempotencyKey: randomUUID(), customer, fulfillment: "PICKUP" });
    if (!r.ok) throw new Error(r.error);
    expect((await stockOf()).reserved).toBe(1);
    await applyPaymentOutcome(r.orderId, "REJECTED");
    expect(await stockOf()).toEqual({ stock: 3, reserved: 0 });
  });

  it("pedido não pago no prazo é cancelado e a reserva volta", async () => {
    const r = await createOrderFromCart(summary(1), { idempotencyKey: randomUUID(), customer, fulfillment: "PICKUP" });
    if (!r.ok) throw new Error(r.error);
    await db.order.update({ where: { id: r.orderId }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleReservations();
    expect((await db.order.findUniqueOrThrow({ where: { id: r.orderId } })).status).toBe("CANCELED");
    expect(await stockOf()).toEqual({ stock: 3, reserved: 0 });
  });

  it("dois checkouts simultâneos pela última unidade: só um consegue", async () => {
    await db.productVariant.update({ where: { id: variantId }, data: { stock: 1, reserved: 0 } });
    const results = await Promise.all([1, 2, 3].map(() => createOrderFromCart(summary(1), { idempotencyKey: randomUUID(), customer, fulfillment: "PICKUP" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await stockOf()).toEqual({ stock: 1, reserved: 1 });
  });
});
