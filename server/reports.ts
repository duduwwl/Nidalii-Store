import "server-only";
import { db } from "@/lib/db";

const TZ_OFFSET_H = -3; // America/Sao_Paulo (sem horário de verão desde 2019)

export function sinceDays(days: number) {
  return new Date(Date.now() - days * 864e5);
}

function dayKey(d: Date) {
  return new Date(d.getTime() + TZ_OFFSET_H * 3600e3).toISOString().slice(0, 10);
}

/** Receita confirmada (pedidos pagos, menos reembolsados) por dia. */
export async function revenueByDay(days: number) {
  const since = new Date(Date.now() - days * 864e5);
  const orders = await db.order.findMany({
    where: { paidAt: { gte: since }, status: { not: "REFUNDED" } },
    select: { paidAt: true, totalCents: true },
  });
  const map = new Map<string, { value: number; orders: number }>();
  for (const o of orders) {
    const k = dayKey(o.paidAt!);
    const cur = map.get(k) ?? { value: 0, orders: 0 };
    cur.value += o.totalCents;
    cur.orders += 1;
    map.set(k, cur);
  }
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const k = dayKey(d);
    out.push({ date: k, label: fmt.format(new Date(`${k}T12:00:00Z`)), ...(map.get(k) ?? { value: 0, orders: 0 }) });
  }
  return out;
}

export async function dashboardStats() {
  const [totalOrders, paidAgg, pendingPayment, toFulfil, products, lowStock, soldOut] = await Promise.all([
    db.order.count(),
    db.order.aggregate({ where: { paidAt: { not: null }, status: { not: "REFUNDED" } }, _sum: { totalCents: true }, _count: true }),
    db.order.count({ where: { status: "AWAITING_PAYMENT" } }),
    db.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    db.product.count({ where: { status: { not: "ARCHIVED" } } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE v."isActive" AND p.status <> 'ARCHIVED' AND (v.stock - v.reserved) > 0 AND (v.stock - v.reserved) <= v."lowStockAt"`,
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE v."isActive" AND p.status <> 'ARCHIVED' AND (v.stock - v.reserved) <= 0`,
  ]);
  return {
    totalOrders,
    revenueCents: paidAgg._sum.totalCents ?? 0,
    paidOrders: paidAgg._count,
    pendingPayment,
    toFulfil,
    products,
    lowStock: Number(lowStock[0]?.n ?? 0),
    soldOut: Number(soldOut[0]?.n ?? 0),
  };
}

export async function topProducts(days: number, take = 10) {
  const since = new Date(Date.now() - days * 864e5);
  const rows = await db.orderItem.groupBy({
    by: ["productName"],
    where: { order: { paidAt: { gte: since }, status: { not: "REFUNDED" } } },
    _sum: { quantity: true, totalCents: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take,
  });
  return rows.map((r) => ({ name: r.productName, units: r._sum.quantity ?? 0, revenueCents: r._sum.totalCents ?? 0 }));
}
