import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const PAGE_SIZE = 24;

export const SORTS = {
  recentes: "Mais recentes",
  "menor-preco": "Menor preço",
  "maior-preco": "Maior preço",
  nome: "Nome",
  "mais-vendidos": "Mais vendidos",
} as const;
export type SortKey = keyof typeof SORTS;

const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v == null ? [] : Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean));
const cents = z.coerce.number().int().nonnegative().optional().catch(undefined);

export const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  categoria: list,
  tamanho: list,
  cor: list,
  colecao: z.string().trim().max(80).optional().catch(undefined),
  min: cents, // em reais na URL
  max: cents,
  disponivel: z.enum(["1"]).optional().catch(undefined),
  promocao: z.enum(["1"]).optional().catch(undefined),
  ordem: z.enum(Object.keys(SORTS) as [SortKey, ...SortKey[]]).optional().catch(undefined),
  pagina: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type CatalogFilters = z.infer<typeof filtersSchema>;

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): CatalogFilters {
  return filtersSchema.parse(searchParams);
}

/** Só produtos ativos, publicados e com preço definido entram na vitrine. */
export function sellable(): Prisma.ProductWhereInput {
  return { status: "ACTIVE", priceCents: { not: null }, publishedAt: { lte: new Date() } };
}

export const cardInclude = {
  images: { orderBy: { position: "asc" }, take: 6 },
  variants: { where: { isActive: true }, select: { id: true, colorName: true, colorHex: true, size: true, stock: true, reserved: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function buildWhere(f: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [sellable()];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { description: { contains: f.q, mode: "insensitive" } },
        { category: { name: { contains: f.q, mode: "insensitive" } } },
      ],
    });
  }
  if (f.categoria.length) and.push({ category: { slug: { in: f.categoria } } });
  if (f.colecao) and.push({ collections: { some: { collection: { slug: f.colecao, isVisible: true } } } });
  if (f.min != null) and.push({ priceCents: { gte: f.min * 100 } });
  if (f.max != null) and.push({ priceCents: { lte: f.max * 100 } });
  if (f.promocao) and.push({ compareAtCents: { not: null } });

  const variant: Prisma.ProductVariantWhereInput = { isActive: true };
  if (f.tamanho.length) variant.size = { in: f.tamanho };
  if (f.cor.length) variant.colorName = { in: f.cor };
  if (f.disponivel) variant.stock = { gt: 0 };
  if (f.tamanho.length || f.cor.length || f.disponivel) and.push({ variants: { some: variant } });
  return { AND: and };
}

export async function searchProducts(f: CatalogFilters) {
  const where = buildWhere(f);
  const page = f.pagina ?? 1;
  const sort = f.ordem ?? "recentes";

  if (sort === "mais-vendidos") {
    // Ordenação por unidades vendidas em pedidos pagos (dados reais)
    const ids = await db.product.findMany({ where, select: { id: true } });
    const sales = await db.orderItem.groupBy({
      by: ["variantId"],
      where: { order: { paidAt: { not: null } }, variant: { productId: { in: ids.map((p) => p.id) } } },
      _sum: { quantity: true },
    });
    const variants = await db.productVariant.findMany({
      where: { id: { in: sales.map((s) => s.variantId) } },
      select: { id: true, productId: true },
    });
    const productOf = new Map(variants.map((v) => [v.id, v.productId]));
    const byProduct = new Map<string, number>();
    for (const s of sales) {
      const pid = productOf.get(s.variantId);
      if (pid) byProduct.set(pid, (byProduct.get(pid) ?? 0) + (s._sum.quantity ?? 0));
    }
    const ordered = ids.map((p) => p.id).toSorted((a, b) => (byProduct.get(b) ?? 0) - (byProduct.get(a) ?? 0));
    const pageIds = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const items = await db.product.findMany({ where: { id: { in: pageIds } }, include: cardInclude });
    items.sort((a, b) => pageIds.indexOf(a.id) - pageIds.indexOf(b.id));
    return { items, total: ids.length, page, pages: Math.max(1, Math.ceil(ids.length / PAGE_SIZE)) };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === "menor-preco" ? { priceCents: "asc" }
    : sort === "maior-preco" ? { priceCents: "desc" }
    : sort === "nome" ? { name: "asc" }
    : { publishedAt: "desc" };

  const [items, total] = await Promise.all([
    db.product.findMany({ where, include: cardInclude, orderBy: [orderBy, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Opções dos filtros: só mostra o que existe em produtos à venda. */
export const getFacets = cache(async () => {
  const [categories, variants, prices, collections, hasSale] = await Promise.all([
    db.category.findMany({
      where: { isVisible: true, products: { some: sellable() } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { name: true, slug: true, _count: { select: { products: { where: sellable() } } } },
    }),
    db.productVariant.findMany({
      where: { isActive: true, product: sellable() },
      select: { size: true, colorName: true, colorHex: true },
    }),
    db.product.aggregate({ where: sellable(), _min: { priceCents: true }, _max: { priceCents: true } }),
    db.collection.findMany({
      where: { isVisible: true, products: { some: { product: sellable() } } },
      orderBy: { position: "asc" },
      select: { name: true, slug: true },
    }),
    db.product.count({ where: { ...sellable(), compareAtCents: { not: null } } }),
  ]);
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean) as string[])].sort(sizeOrder);
  const colorMap = new Map<string, string | null>();
  for (const v of variants) if (v.colorName && !colorMap.has(v.colorName)) colorMap.set(v.colorName, v.colorHex);
  const colors = [...colorMap].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    categories,
    sizes,
    colors,
    collections,
    hasSale: hasSale > 0,
    minPrice: prices._min.priceCents,
    maxPrice: prices._max.priceCents,
  };
});

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "U", "ÚNICO"];
export function sizeOrder(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase());
  const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, "pt-BR");
}

export const getProductBySlug = cache(async (slug: string) => {
  return db.product.findFirst({
    where: { slug, ...sellable() },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { where: { isActive: true }, orderBy: [{ colorName: "asc" }] },
      category: true,
      collections: { include: { collection: { select: { name: true, slug: true, isVisible: true } } } },
    },
  });
});

/** Primeiro da mesma categoria; completa com as novidades para a fileira nunca ficar pela metade. */
export async function getRelated(productId: string, categoryId: string | null, take = 4) {
  const same = categoryId
    ? await db.product.findMany({ where: { ...sellable(), id: { not: productId }, categoryId }, include: cardInclude, orderBy: { publishedAt: "desc" }, take })
    : [];
  if (same.length >= take) return same;
  const more = await db.product.findMany({
    where: { ...sellable(), id: { notIn: [productId, ...same.map((p) => p.id)] } },
    include: cardInclude, orderBy: { publishedAt: "desc" }, take: take - same.length,
  });
  return [...same, ...more];
}

export async function getNewArrivals(take = 8) {
  return db.product.findMany({ where: sellable(), include: cardInclude, orderBy: { publishedAt: "desc" }, take });
}

export async function getFeatured(take = 8) {
  return db.product.findMany({
    where: { ...sellable(), isFeatured: true },
    include: cardInclude,
    orderBy: [{ featuredPosition: "asc" }, { publishedAt: "desc" }],
    take,
  });
}

export async function getCollections(opts: { featuredOnly?: boolean } = {}) {
  const now = new Date();
  return db.collection.findMany({
    where: {
      isVisible: true,
      ...(opts.featuredOnly ? { isFeatured: true } : {}),
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      products: { some: { product: sellable() } },
    },
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    include: {
      products: {
        where: { product: sellable() },
        orderBy: { position: "asc" },
        take: 4,
        include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
      },
      _count: { select: { products: { where: { product: sellable() } } } },
    },
  });
}

export function availableStock(v: { stock: number; reserved: number }) {
  return Math.max(0, v.stock - v.reserved);
}
