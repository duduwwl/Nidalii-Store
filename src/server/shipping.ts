import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getSettings } from "./settings";
import type { CartSummary } from "./cart";

const ME_BASE =
  process.env.MELHOR_ENVIO_ENV === "production" ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";
const QUOTE_TTL_MIN = 30;

export type QuoteOption = {
  id: string; // id da ShippingQuote salva no banco
  serviceName: string;
  carrier: string | null;
  priceCents: number;
  daysMin: number | null;
  daysMax: number | null;
};

export type QuoteResult =
  | { ok: true; options: QuoteOption[] }
  | { ok: false; error: string; reason: "not_configured" | "missing_dimensions" | "unavailable" | "invalid_cep" };

type MeService = {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  delivery_range?: { min: number; max: number };
  custom_delivery_range?: { min: number; max: number };
  company?: { name: string };
  error?: string;
};

/**
 * Cota frete no Melhor Envio com peso e medidas reais das peças.
 * Nunca devolve valor inventado: sem configuração, sem cotação.
 */
export async function quoteShipping(
  cart: Pick<CartSummary, "cartId" | "lines" | "subtotalCents">,
  destinationCep: string,
): Promise<QuoteResult> {
  const cep = destinationCep.replace(/\D/g, "");
  if (cep.length !== 8) return { ok: false, error: "CEP inválido.", reason: "invalid_cep" };
  const s = await getSettings();
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token || !s.originCep || s.enabledShippingServices.length === 0) {
    return { ok: false, reason: "not_configured", error: "O cálculo de frete ainda não foi configurado pela loja." };
  }
  if (cart.lines.length === 0) return { ok: false, error: "Seu carrinho está vazio.", reason: "unavailable" };

  const products = [];
  for (const l of cart.lines.filter((x) => !x.problem)) {
    const weight = l.weightGrams ?? s.defaultWeightGrams;
    const length = l.dims.l ?? s.defaultLengthCm;
    const width = l.dims.w ?? s.defaultWidthCm;
    const height = l.dims.h ?? s.defaultHeightCm;
    if (!weight || !length || !width || !height) {
      return { ok: false, reason: "missing_dimensions", error: "A loja ainda não cadastrou peso e medidas de uma das peças." };
    }
    products.push({
      id: l.variantId,
      width, height, length,
      weight: weight / 1000,
      insurance_value: l.unitCents / 100,
      quantity: l.quantity,
    });
  }

  const packageHash = createHash("sha256").update(JSON.stringify(products)).digest("hex").slice(0, 32);

  let data: MeService[];
  try {
    const res = await fetch(`${ME_BASE}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": `Nidalii Store (${process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "contato"})`,
      },
      body: JSON.stringify({
        from: { postal_code: s.originCep },
        to: { postal_code: cep },
        products,
        options: { receipt: false, own_hand: false },
        services: s.enabledShippingServices.join(","),
      }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[frete] Melhor Envio respondeu", res.status, await res.text().catch(() => ""));
      return { ok: false, reason: "unavailable", error: "Não foi possível calcular o frete agora. Tente de novo em instantes." };
    }
    data = (await res.json()) as MeService[];
  } catch (e) {
    console.error("[frete] falha na cotação", e);
    return { ok: false, reason: "unavailable", error: "Não foi possível calcular o frete agora. Tente de novo em instantes." };
  }

  const valid = data.filter((d) => !d.error && (d.custom_price ?? d.price));
  if (valid.length === 0) return { ok: false, reason: "unavailable", error: "Nenhuma transportadora atende este CEP." };

  const freeAbove = s.freeShippingMinCents;
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MIN * 6e4);
  const options: QuoteOption[] = [];
  const cheapest = Math.min(...valid.map((d) => Math.round(Number(d.custom_price ?? d.price) * 100)));
  for (const d of valid) {
    let priceCents = Math.round(Number(d.custom_price ?? d.price) * 100);
    // Regra comercial: frete grátis na opção mais barata acima do valor configurado
    if (freeAbove != null && cart.subtotalCents >= freeAbove && priceCents === cheapest) priceCents = 0;
    const range = d.custom_delivery_range ?? d.delivery_range;
    const q = await db.shippingQuote.create({
      data: {
        cartId: cart.cartId,
        destinationCep: cep,
        provider: "melhorenvio",
        serviceId: String(d.id),
        serviceName: d.name,
        carrier: d.company?.name ?? null,
        priceCents,
        deliveryDaysMin: range?.min ?? d.delivery_time ?? null,
        deliveryDaysMax: range?.max ?? d.delivery_time ?? null,
        packageHash,
        expiresAt,
      },
    });
    options.push({
      id: q.id, serviceName: q.serviceName, carrier: q.carrier, priceCents: q.priceCents,
      daysMin: q.deliveryDaysMin, daysMax: q.deliveryDaysMax,
    });
  }
  options.sort((a, b) => a.priceCents - b.priceCents);
  return { ok: true, options };
}
