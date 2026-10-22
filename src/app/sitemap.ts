import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { sellable } from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const [products, collections, categories] = await Promise.all([
    db.product.findMany({ where: sellable(), select: { slug: true, updatedAt: true } }),
    db.collection.findMany({ where: { isVisible: true, products: { some: { product: sellable() } } }, select: { slug: true, updatedAt: true } }),
    db.category.findMany({ where: { isVisible: true, products: { some: sellable() } }, select: { slug: true, updatedAt: true } }),
  ]);
  const fixed = ["", "/produtos", "/novidades", "/colecoes", "/sobre", "/contato", "/entregas", "/trocas-e-devolucoes", "/politica-de-privacidade", "/termos-de-uso"];
  return [
    ...fixed.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...categories.map((c) => ({ url: `${base}/produtos?categoria=${c.slug}`, lastModified: c.updatedAt, priority: 0.7 })),
    ...collections.map((c) => ({ url: `${base}/colecoes/${c.slug}`, lastModified: c.updatedAt, priority: 0.7 })),
    ...products.map((p) => ({ url: `${base}/produtos/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
  ];
}
