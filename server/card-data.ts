import "server-only";
import type { CardData } from "@/components/store/product-card";
import { availableStock, sizeOrder, type CardProduct } from "./catalog";

const NEW_DAYS = 21;

export function toCardData(p: CardProduct): CardData {
  const colors = new Map<string, string | null>();
  const sizes = new Set<string>();
  let free = 0;
  for (const v of p.variants) {
    if (v.colorName && !colors.has(v.colorName)) colors.set(v.colorName, v.colorHex);
    const avail = availableStock(v);
    if (v.size && avail > 0) sizes.add(v.size);
    free += avail;
  }
  // Fotos de produto primeiro; as editoriais ficam para o fim
  const imgs = [...p.images].sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === "product" ? -1 : 1));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceCents: p.priceCents ?? 0,
    compareAtCents: p.compareAtCents,
    images: imgs.slice(0, 2).map((i) => ({ url: i.url, alt: i.alt })),
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    sizes: [...sizes].sort(sizeOrder),
    soldOut: p.variants.length === 0 || free === 0,
    isNew: !!p.publishedAt && Date.now() - p.publishedAt.getTime() < NEW_DAYS * 864e5,
  };
}
