import Link from "next/link";
import { Suspense } from "react";
import { getFacets, searchProducts, type CatalogFilters } from "@/server/catalog";
import { toCardData } from "@/server/card-data";
import { ProductCard } from "./product-card";
import { FilterPanel, MobileFilters, SortSelect, type Facets } from "./catalog-filters";

/** Grade com filtros, usada em /produtos, /novidades e /colecoes/[slug]. */
export async function ProductListing({
  filters, basePath, rawParams, hideCategory, hideCollection, emptyText,
}: {
  filters: CatalogFilters;
  basePath: string;
  rawParams: Record<string, string | string[] | undefined>;
  hideCategory?: boolean;
  hideCollection?: boolean;
  emptyText?: string;
}) {
  const [result, f] = await Promise.all([searchProducts(filters), getFacets()]);
  const facets: Facets = {
    categories: f.categories.map((c) => ({ name: c.name, slug: c.slug, count: c._count.products })),
    sizes: f.sizes, colors: f.colors, collections: f.collections, hasSale: f.hasSale,
    minPrice: f.minPrice, maxPrice: f.maxPrice,
  };
  const anyFilter = Object.entries(rawParams).some(([k, v]) => v && k !== "ordem" && k !== "pagina");

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string" && k !== "pagina") p.set(k, v);
    if (n > 1) p.set("pagina", String(n));
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="wrap grid gap-8 lg:grid-cols-12 lg:gap-6">
      <aside className="hidden lg:col-span-3 lg:block xl:col-span-2" aria-label="Filtros">
        <div className="sticky top-[calc(var(--header-h)+1.5rem)] max-h-[calc(100dvh-var(--header-h)-3rem)] overflow-y-auto pb-8 pr-2">
          <Suspense><FilterPanel facets={facets} hideCategory={hideCategory} hideCollection={hideCollection} /></Suspense>
        </div>
      </aside>

      <div className="grid content-start gap-6 lg:col-span-9 xl:col-span-10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <p className="text-sm text-graphite" aria-live="polite">{result.total} {result.total === 1 ? "produto" : "produtos"}</p>
          <div className="flex items-center gap-3">
            <Suspense><MobileFilters facets={facets} total={result.total} hideCategory={hideCategory} hideCollection={hideCollection} /></Suspense>
            <Suspense><SortSelect /></Suspense>
          </div>
        </div>

        {result.items.length === 0 ? (
          <div className="grid justify-items-start gap-5 py-16">
            <p className="font-display text-[2rem] leading-tight">{anyFilter ? "Nenhuma peça com esses filtros." : emptyText ?? "As peças aparecem aqui assim que forem cadastradas."}</p>
            {anyFilter ? (
              <Link href={basePath} className="btn btn-ghost">Limpar filtros</Link>
            ) : (
              <p className="text-graphite">Enquanto isso, acompanhe as novidades no Instagram.</p>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:gap-x-4 lg:gap-y-12 xl:grid-cols-4">
            {result.items.map((p, i) => (
              <li key={p.id}><ProductCard p={toCardData(p)} priority={i < 4} sizes="(min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" /></li>
            ))}
          </ul>
        )}

        {result.pages > 1 && (
          <nav aria-label="Páginas" className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {result.page > 1 && <Link className="btn btn-ghost btn-sm" href={pageHref(result.page - 1)} rel="prev">Anterior</Link>}
            {Array.from({ length: result.pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === result.pages || Math.abs(n - result.page) <= 1)
              .map((n, i, arr) => (
                <span key={n} className="flex items-center gap-2">
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-graphite">…</span>}
                  <Link href={pageHref(n)} aria-current={n === result.page ? "page" : undefined}
                    className={`grid size-10 place-items-center text-sm ${n === result.page ? "bg-ink text-white" : "border border-line"}`}>{n}</Link>
                </span>
              ))}
            {result.page < result.pages && <Link className="btn btn-ghost btn-sm" href={pageHref(result.page + 1)} rel="next">Próxima</Link>}
          </nav>
        )}
      </div>
    </div>
  );
}
