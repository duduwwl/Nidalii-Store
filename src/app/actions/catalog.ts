"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { cardInclude, parseFilters, searchProducts, sellable } from "@/server/catalog";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type SearchHit = { id: string; name: string; slug: string; priceCents: number; image: { url: string; alt: string } | null; category: string | null };

export async function quickSearchAction(q: string): Promise<{ hits: SearchHit[]; total: number }> {
  const query = z.string().trim().min(2).max(80).safeParse(q);
  if (!query.success) return { hits: [], total: 0 };
  if (!(await rateLimit(`search:${await clientIp()}`, 120, 60))) return { hits: [], total: 0 };
  const res = await searchProducts(parseFilters({ q: query.data }));
  return {
    total: res.total,
    hits: res.items.slice(0, 6).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      priceCents: p.priceCents ?? 0,
      image: p.images[0] ? { url: p.images[0].url, alt: p.images[0].alt } : null,
      category: p.category?.name ?? null,
    })),
  };
}

/** Produtos favoritados por visitantes (ids guardados no navegador). */
export async function productsByIdsAction(ids: string[]) {
  const list = z.array(z.string().min(1).max(40)).max(200).safeParse(ids);
  if (!list.success || list.data.length === 0) return [];
  const items = await db.product.findMany({ where: { ...sellable(), id: { in: list.data } }, include: cardInclude });
  return items;
}
