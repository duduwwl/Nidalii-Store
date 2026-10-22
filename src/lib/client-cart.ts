import type { CartSummary } from "@/server/cart";

/** Versão do carrinho segura para enviar ao navegador. */
export function toClientCart(s: CartSummary) {
  return {
    count: s.count,
    subtotalCents: s.subtotalCents,
    couponCode: s.couponCode,
    hasProblems: s.hasProblems,
    lines: s.lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      name: l.name,
      slug: l.slug,
      colorName: l.colorName,
      size: l.size,
      image: l.image,
      quantity: l.quantity,
      unitCents: l.unitCents,
      totalCents: l.totalCents,
      available: l.available,
      problem: l.problem,
    })),
  };
}

export type ClientCart = ReturnType<typeof toClientCart>;
export type ClientCartLine = ClientCart["lines"][number];
