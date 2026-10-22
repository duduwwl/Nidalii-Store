import "server-only";
import type { InventoryReason, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class OutOfStockError extends Error {
  constructor(public sku: string) {
    super(`Sem estoque suficiente para ${sku}`);
  }
}

/** Reserva atômica: só reserva se houver saldo livre. Evita vender acima do estoque. */
export async function reserve(tx: Tx, items: { variantId: string; sku: string; quantity: number }[], orderId: string) {
  for (const it of items) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant" SET "reserved" = "reserved" + ${it.quantity}, "updatedAt" = now()
      WHERE "id" = ${it.variantId} AND "isActive" = true AND ("stock" - "reserved") >= ${it.quantity}`;
    if (updated !== 1) throw new OutOfStockError(it.sku);
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: it.variantId, delta: 0, reason: "RESERVATION", orderId, stockAfter: v.stock, note: `Reserva de ${it.quantity}` },
    });
  }
}

/** Libera reservas (pagamento recusado ou expirado). */
export async function release(tx: Tx, items: { variantId: string; quantity: number }[], orderId: string) {
  for (const it of items) {
    await tx.$executeRaw`
      UPDATE "ProductVariant" SET "reserved" = GREATEST(0, "reserved" - ${it.quantity}), "updatedAt" = now()
      WHERE "id" = ${it.variantId}`;
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: it.variantId, delta: 0, reason: "RELEASE", orderId, stockAfter: v.stock, note: `Liberação de ${it.quantity}` },
    });
  }
}

/** Baixa definitiva após pagamento confirmado: reserva vira venda. */
export async function commitSale(tx: Tx, items: { variantId: string; quantity: number }[], orderId: string) {
  for (const it of items) {
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${it.quantity}, "reserved" = GREATEST(0, "reserved" - ${it.quantity}), "updatedAt" = now()
      WHERE "id" = ${it.variantId}`;
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: it.variantId }, select: { stock: true } });
    await tx.inventoryMovement.create({
      data: { variantId: it.variantId, delta: -it.quantity, reason: "SALE", orderId, stockAfter: v.stock },
    });
  }
}

/** Entrada, ajuste ou reposição (painel, cancelamento de pedido pago, devolução). */
export async function adjustStock(
  tx: Tx,
  p: { variantId: string; delta: number; reason: InventoryReason; actorId?: string | null; orderId?: string | null; note?: string | null },
) {
  const rows = await tx.$queryRaw<{ stock: number }[]>`
    UPDATE "ProductVariant" SET "stock" = GREATEST(0, "stock" + ${p.delta}), "updatedAt" = now()
    WHERE "id" = ${p.variantId} RETURNING "stock"`;
  const stockAfter = rows[0]?.stock ?? 0;
  await tx.inventoryMovement.create({
    data: {
      variantId: p.variantId, delta: p.delta, reason: p.reason, actorId: p.actorId ?? null,
      orderId: p.orderId ?? null, note: p.note ?? null, stockAfter,
    },
  });
  return stockAfter;
}
