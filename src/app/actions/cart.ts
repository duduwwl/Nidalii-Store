"use server";

import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { currentUser } from "@/lib/auth";
import { addToCart, getCartSummary, readCart, setCartCoupon, setCartQuantity, summarizeCart } from "@/server/cart";
import { evaluateCoupon } from "@/server/coupons";
import { quoteShipping, type QuoteOption } from "@/server/shipping";
import { lookupCep, type CepAddress } from "@/server/cep";
import { toClientCart, type ClientCart } from "@/lib/client-cart";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function addToCartAction(variantId: string, quantity = 1): Promise<Res<{ cart: ClientCart }>> {
  if (!(await rateLimit(`cart:${await clientIp()}`, 60, 60))) return { ok: false, error: "Muitas ações seguidas. Aguarde um instante." };
  const parsed = z.object({ variantId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(10) }).safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, error: "Escolha cor e tamanho." };
  const res = await addToCart(parsed.data.variantId, parsed.data.quantity);
  if (!res.ok) return res;
  return { ok: true, cart: toClientCart(await getCartSummary()) };
}

export async function setQuantityAction(itemId: string, quantity: number): Promise<Res<{ cart: ClientCart }>> {
  const q = Math.max(0, Math.min(10, Math.floor(Number(quantity) || 0)));
  const res = await setCartQuantity(String(itemId), q);
  const cart = toClientCart(await getCartSummary());
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, cart };
}

export async function getCartAction(): Promise<ClientCart> {
  return toClientCart(await getCartSummary());
}

export async function applyCouponAction(code: string): Promise<Res<{ cart: ClientCart; discountCents: number }>> {
  if (!(await rateLimit(`coupon:${await clientIp()}`, 15, 600))) return { ok: false, error: "Muitas tentativas. Tente de novo em alguns minutos." };
  const clean = String(code ?? "").trim().toUpperCase().slice(0, 40);
  if (!clean) return { ok: false, error: "Digite o código do cupom." };
  const summary = summarizeCart(await readCart());
  if (summary.lines.length === 0) return { ok: false, error: "Seu carrinho está vazio." };
  const user = await currentUser();
  const res = await evaluateCoupon(clean, summary.subtotalCents, { id: user?.customer?.id, email: user?.email });
  if (!res.ok) return res;
  await setCartCoupon(clean);
  return { ok: true, discountCents: res.discountCents, cart: toClientCart(await getCartSummary()) };
}

export async function removeCouponAction(): Promise<ClientCart> {
  await setCartCoupon(null);
  return toClientCart(await getCartSummary());
}

/** Desconto do cupom salvo no carrinho, recalculado no servidor. */
export async function cartDiscountAction(): Promise<{ code: string | null; discountCents: number; error: string | null }> {
  const summary = summarizeCart(await readCart());
  if (!summary.couponCode) return { code: null, discountCents: 0, error: null };
  const user = await currentUser();
  const res = await evaluateCoupon(summary.couponCode, summary.subtotalCents, { id: user?.customer?.id, email: user?.email });
  return res.ok
    ? { code: summary.couponCode, discountCents: res.discountCents, error: null }
    : { code: summary.couponCode, discountCents: 0, error: res.error };
}

export async function quoteShippingAction(cep: string): Promise<Res<{ options: QuoteOption[] }>> {
  if (!(await rateLimit(`ship:${await clientIp()}`, 30, 600))) return { ok: false, error: "Muitas consultas. Tente de novo em alguns minutos." };
  const summary = summarizeCart(await readCart());
  const res = await quoteShipping(summary, String(cep ?? ""));
  return res.ok ? { ok: true, options: res.options } : { ok: false, error: res.error };
}

/** Estimativa na página do produto (uma unidade da variante escolhida). Não vale para o checkout. */
export async function quoteProductShippingAction(variantId: string, cep: string): Promise<Res<{ options: QuoteOption[] }>> {
  if (!(await rateLimit(`ship:${await clientIp()}`, 30, 600))) return { ok: false, error: "Muitas consultas. Tente de novo em alguns minutos." };
  const v = await db.productVariant.findUnique({ where: { id: String(variantId) }, include: { product: true } });
  if (!v || v.product.priceCents == null) return { ok: false, error: "Escolha cor e tamanho." };
  const unit = v.priceCents ?? v.product.priceCents;
  const res = await quoteShipping(
    {
      cartId: null,
      subtotalCents: unit,
      lines: [{
        id: "estimativa", variantId: v.id, productId: v.productId, name: v.product.name, slug: v.product.slug, sku: v.sku,
        colorName: v.colorName, size: v.size, image: null, quantity: 1, unitCents: unit, compareAtCents: null, totalCents: unit,
        available: 1, problem: null, weightGrams: v.weightGrams ?? v.product.weightGrams,
        dims: { l: v.product.lengthCm, w: v.product.widthCm, h: v.product.heightCm },
      }],
    },
    String(cep ?? ""),
  );
  return res.ok ? { ok: true, options: res.options } : { ok: false, error: res.error };
}

export async function lookupCepAction(cep: string): Promise<Res<{ address: CepAddress }>> {
  if (!(await rateLimit(`cep:${await clientIp()}`, 40, 600))) return { ok: false, error: "Muitas consultas. Tente de novo em alguns minutos." };
  const address = await lookupCep(String(cep ?? ""));
  if (!address) return { ok: false, error: "Não encontramos esse CEP. Confira os números ou preencha o endereço manualmente." };
  return { ok: true, address };
}
