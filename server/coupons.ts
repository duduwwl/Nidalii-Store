import "server-only";
import type { Coupon } from "@prisma/client";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

export type CouponResult =
  | { ok: true; coupon: Coupon; discountCents: number }
  | { ok: false; error: string };

export function computeDiscount(coupon: Pick<Coupon, "type" | "value">, subtotalCents: number) {
  const raw = coupon.type === "PERCENT" ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotalCents));
}

export async function evaluateCoupon(
  code: string,
  subtotalCents: number,
  customer?: { id?: string | null; email?: string | null },
): Promise<CouponResult> {
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!coupon || !coupon.isActive) return { ok: false, error: "Cupom não encontrado." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "Este cupom ainda não está valendo." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "Este cupom expirou." };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return { ok: false, error: "Este cupom atingiu o limite de usos." };
  if (coupon.minOrderCents != null && subtotalCents < coupon.minOrderCents) {
    return { ok: false, error: `Válido para compras a partir de ${formatCents(coupon.minOrderCents)}.` };
  }
  if (coupon.maxUsesPerCustomer != null && (customer?.id || customer?.email)) {
    const used = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        customer: customer.id ? { id: customer.id } : { email: customer.email! },
        order: { status: { notIn: ["CANCELED", "PAYMENT_FAILED"] } },
      },
    });
    if (used >= coupon.maxUsesPerCustomer) return { ok: false, error: "Você já usou este cupom." };
  }
  return { ok: true, coupon, discountCents: computeDiscount(coupon, subtotalCents) };
}
