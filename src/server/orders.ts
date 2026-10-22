import "server-only";
import type { FulfillmentType, OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { commitSale, release, reserve, adjustStock, OutOfStockError } from "./inventory";
import { evaluateCoupon } from "./coupons";
import type { CartSummary } from "./cart";

/** Transições permitidas. O que não está aqui é recusado. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["AWAITING_PAYMENT", "CANCELED"],
  AWAITING_PAYMENT: ["PAID", "PAYMENT_FAILED", "CANCELED"],
  PAYMENT_FAILED: ["AWAITING_PAYMENT", "CANCELED"],
  PAID: ["PREPARING", "CANCELED", "REFUNDED"],
  PREPARING: ["SHIPPED", "READY_FOR_PICKUP", "CANCELED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  READY_FOR_PICKUP: ["PICKED_UP", "CANCELED", "REFUNDED"],
  PICKED_UP: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: "Pedido criado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PAYMENT_FAILED: "Pagamento recusado",
  CANCELED: "Cancelado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  READY_FOR_PICKUP: "Disponível para retirada",
  PICKED_UP: "Retirado",
  REFUNDED: "Reembolsado",
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

const RESERVATION_MINUTES = 35; // um pouco acima do vencimento padrão do Pix

export type CheckoutInput = {
  idempotencyKey: string;
  customer: { fullName: string; email: string; cpf: string; phone: string; userId?: string | null; customerId?: string | null };
  fulfillment: FulfillmentType;
  address?: {
    recipient: string; cep: string; street: string; number: string; complement?: string | null;
    neighborhood: string; city: string; state: string; reference?: string | null;
  };
  shippingQuoteId?: string | null;
  couponCode?: string | null;
  note?: string | null;
};

export type CreateOrderResult =
  | { ok: true; orderId: string; existing: boolean }
  | { ok: false; error: string };

/**
 * Cria o pedido a partir do carrinho, recalculando tudo no servidor
 * e reservando estoque na mesma transação.
 */
export async function createOrderFromCart(cart: CartSummary, input: CheckoutInput): Promise<CreateOrderResult> {
  const dup = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
  if (dup) return { ok: true, orderId: dup.id, existing: true };

  if (!cart.cartId || cart.lines.length === 0) return { ok: false, error: "Seu carrinho está vazio." };
  if (cart.hasProblems) return { ok: false, error: "Alguns itens do carrinho mudaram de disponibilidade. Revise o carrinho." };

  const subtotal = cart.subtotalCents;

  // Frete: só vale cotação feita pelo servidor, ainda válida e do mesmo carrinho
  let shippingCents = 0;
  let quote: Awaited<ReturnType<typeof db.shippingQuote.findUnique>> = null;
  if (input.fulfillment === "DELIVERY") {
    if (!input.address) return { ok: false, error: "Informe o endereço de entrega." };
    if (!input.shippingQuoteId) return { ok: false, error: "Escolha uma opção de frete." };
    quote = await db.shippingQuote.findUnique({ where: { id: input.shippingQuoteId } });
    const cep = input.address.cep.replace(/\D/g, "");
    if (!quote || quote.cartId !== cart.cartId || quote.destinationCep !== cep || quote.expiresAt < new Date()) {
      return { ok: false, error: "A cotação de frete expirou. Calcule o frete de novo." };
    }
    shippingCents = quote.priceCents;
  }

  // Cupom: reavaliado aqui, nunca aceito do navegador
  let discountCents = 0;
  let couponId: string | null = null;
  const code = input.couponCode?.trim();
  if (code) {
    const res = await evaluateCoupon(code, subtotal, { id: input.customer.customerId, email: input.customer.email });
    if (!res.ok) return { ok: false, error: res.error };
    discountCents = res.discountCents;
    couponId = res.coupon.id;
  }

  const total = subtotal - discountCents + shippingCents;
  if (total <= 0) return { ok: false, error: "O total do pedido precisa ser maior que zero." };

  try {
    const order = await db.$transaction(async (tx) => {
      const customer = input.customer.customerId
        ? await tx.customer.update({
            where: { id: input.customer.customerId },
            data: { fullName: input.customer.fullName, cpf: input.customer.cpf, phone: input.customer.phone, consentAt: new Date() },
          })
        : await tx.customer.create({
            data: {
              email: input.customer.email.toLowerCase(),
              fullName: input.customer.fullName,
              cpf: input.customer.cpf,
              phone: input.customer.phone,
              consentAt: new Date(),
            },
          });

      const a = input.address;
      const created = await tx.order.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          customerId: customer.id,
          status: "AWAITING_PAYMENT",
          fulfillment: input.fulfillment,
          subtotalCents: subtotal,
          discountCents,
          shippingCents,
          totalCents: total,
          couponCode: code ? code.toUpperCase() : null,
          customerNote: input.note ?? null,
          reservationExpiresAt: new Date(Date.now() + RESERVATION_MINUTES * 6e4),
          ...(input.fulfillment === "DELIVERY" && a
            ? {
                shipRecipient: a.recipient, shipCep: a.cep.replace(/\D/g, ""), shipStreet: a.street, shipNumber: a.number,
                shipComplement: a.complement || null, shipNeighborhood: a.neighborhood, shipCity: a.city,
                shipState: a.state, shipReference: a.reference || null,
              }
            : {}),
          items: {
            create: cart.lines.map((l) => ({
              variantId: l.variantId, productName: l.name, sku: l.sku, colorName: l.colorName, size: l.size,
              unitCents: l.unitCents, quantity: l.quantity, totalCents: l.totalCents,
            })),
          },
          statusHistory: { create: [{ status: "AWAITING_PAYMENT" }] },
        },
      });

      await reserve(tx, cart.lines.map((l) => ({ variantId: l.variantId, sku: l.sku, quantity: l.quantity })), created.id);

      if (quote) {
        await tx.shipment.create({
          data: {
            orderId: created.id, provider: quote.provider, serviceId: quote.serviceId, serviceName: quote.serviceName,
            carrier: quote.carrier, priceCents: quote.priceCents, deliveryDaysMin: quote.deliveryDaysMin, deliveryDaysMax: quote.deliveryDaysMax,
          },
        });
      }
      if (couponId) {
        await tx.couponRedemption.create({ data: { couponId, orderId: created.id, customerId: customer.id, discountCents } });
      }
      // Guarda o endereço na conta da cliente, quando ela estiver logada
      if (input.customer.customerId && a) {
        const exists = await tx.address.findFirst({ where: { customerId: customer.id, cep: a.cep.replace(/\D/g, ""), number: a.number } });
        if (!exists) {
          const hasAny = await tx.address.count({ where: { customerId: customer.id } });
          await tx.address.create({
            data: {
              customerId: customer.id, recipient: a.recipient, cep: a.cep.replace(/\D/g, ""), street: a.street, number: a.number,
              complement: a.complement || null, neighborhood: a.neighborhood, city: a.city, state: a.state,
              reference: a.reference || null, isDefault: hasAny === 0,
            },
          });
        }
      }
      return created;
    });
    return { ok: true, orderId: order.id, existing: false };
  } catch (e) {
    if (e instanceof OutOfStockError) return { ok: false, error: "Uma das peças esgotou enquanto você finalizava. Revise o carrinho." };
    // Corrida no reenvio do mesmo checkout: devolve o pedido já criado
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      const again = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } });
      if (again) return { ok: true, orderId: again.id, existing: true };
    }
    throw e;
  }
}

/**
 * Nova tentativa depois de um pagamento recusado: reserva as peças de novo antes de cobrar,
 * para nunca aprovar um pagamento sem estoque.
 */
export async function reopenForPayment(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (order.status !== "PAYMENT_FAILED") return;
      const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true, sku: true } });
      await reserve(tx, items, orderId);
      await tx.orderStatusEvent.create({ data: { orderId, status: "AWAITING_PAYMENT", note: "Nova tentativa de pagamento" } });
      await tx.order.update({
        where: { id: orderId },
        data: { status: "AWAITING_PAYMENT", reservationExpiresAt: new Date(Date.now() + RESERVATION_MINUTES * 6e4) },
      });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof OutOfStockError) return { ok: false, error: "Uma das peças esgotou desde a primeira tentativa. Fale com a loja ou monte o carrinho de novo." };
    throw e;
  }
}

/** Esvazia o carrinho depois que o pedido foi criado. */
export async function clearCart(cartId: string) {
  await db.cartItem.deleteMany({ where: { cartId } });
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
}

type Tx = Prisma.TransactionClient;

async function itemsOf(tx: Tx, orderId: string) {
  return tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
}

/**
 * Aplica o resultado de pagamento (vindo do webhook verificado ou da consulta ao provedor).
 * Idempotente: chamar duas vezes com o mesmo status não muda nada.
 */
export async function applyPaymentOutcome(orderId: string, outcome: "APPROVED" | "REJECTED" | "PENDING" | "REFUNDED") {
  return db.$transaction(async (tx) => {
    // trava a linha do pedido para evitar processamento duplo em webhooks simultâneos
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    if (outcome === "APPROVED") {
      if (order.paidAt) return order; // já processado
      if (order.status === "CANCELED") {
        // pagamento chegou depois do cancelamento: registra para o painel tratar (reembolso)
        await tx.orderStatusEvent.create({ data: { orderId, status: "CANCELED", note: "Pagamento aprovado após cancelamento. Verifique reembolso." } });
        return order;
      }
      const items = await itemsOf(tx, orderId);
      if (order.status === "PAYMENT_FAILED") {
        // a reserva foi liberada: reserva de novo antes de baixar
        const withSku = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true, sku: true } });
        await reserve(tx, withSku, orderId);
      }
      await commitSale(tx, items, orderId);
      if (order.couponCode) {
        await tx.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } });
      }
      const next: OrderStatus = "PAID";
      await tx.orderStatusEvent.create({ data: { orderId, status: next, note: "Confirmado pelo provedor de pagamento" } });
      return tx.order.update({ where: { id: orderId }, data: { status: next, paidAt: new Date(), reservationExpiresAt: null } });
    }

    if (outcome === "REJECTED") {
      if (order.paidAt || order.status !== "AWAITING_PAYMENT") return order;
      await release(tx, await itemsOf(tx, orderId), orderId);
      await tx.orderStatusEvent.create({ data: { orderId, status: "PAYMENT_FAILED" } });
      return tx.order.update({ where: { id: orderId }, data: { status: "PAYMENT_FAILED", reservationExpiresAt: null } });
    }

    if (outcome === "REFUNDED") {
      if (order.status === "REFUNDED") return order;
      await tx.orderStatusEvent.create({ data: { orderId, status: "REFUNDED", note: "Estorno confirmado pelo provedor" } });
      return tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });
    }
    return order;
  });
}

/** Mudança de status pelo painel. Cancelamentos repõem ou liberam estoque conforme o caso. */
export async function changeOrderStatus(orderId: string, to: OrderStatus, actorId: string, note?: string | null) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!canTransition(order.status, to)) {
      throw new Error(`Não é possível mudar de "${STATUS_LABEL[order.status]}" para "${STATUS_LABEL[to]}".`);
    }
    if (to === "PAID") throw new Error("O pagamento só é confirmado pelo provedor.");
    if (to === "READY_FOR_PICKUP" && order.fulfillment !== "PICKUP") throw new Error("Este pedido é de entrega.");
    if (to === "SHIPPED" && order.fulfillment !== "DELIVERY") throw new Error("Este pedido é de retirada.");

    const items = await itemsOf(tx, orderId);
    if (to === "CANCELED") {
      if (order.paidAt) {
        for (const it of items) await adjustStock(tx, { variantId: it.variantId, delta: it.quantity, reason: "CANCELLATION", orderId, actorId });
      } else if (order.status === "AWAITING_PAYMENT" || order.status === "CREATED") {
        await release(tx, items, orderId);
      }
    }
    await tx.orderStatusEvent.create({ data: { orderId, status: to, note: note || null, actorId } });
    return tx.order.update({
      where: { id: orderId },
      data: { status: to, ...(to === "CANCELED" ? { canceledAt: new Date(), reservationExpiresAt: null } : {}) },
    });
  });
}

/** Libera reservas de pedidos não pagos que passaram do prazo (rodar via cron). */
export async function expireStaleReservations() {
  const stale = await db.order.findMany({
    where: { status: "AWAITING_PAYMENT", reservationExpiresAt: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const o of stale) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: o.id } });
      if (order.status !== "AWAITING_PAYMENT" || order.paidAt) return;
      await release(tx, await itemsOf(tx, o.id), o.id);
      await tx.orderStatusEvent.create({ data: { orderId: o.id, status: "CANCELED", note: "Prazo de pagamento expirou" } });
      await tx.order.update({ where: { id: o.id }, data: { status: "CANCELED", canceledAt: new Date(), reservationExpiresAt: null } });
    });
  }
  return stale.length;
}
