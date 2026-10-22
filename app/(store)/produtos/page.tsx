import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { parseFilters } from "@/server/catalog";
import { ProductListing } from "@/components/store/product-listing";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  if (f.categoria.length === 1) {
    const c = await db.category.findUnique({ where: { slug: f.categoria[0] } });
    if (c) return { title: c.name, description: c.description ?? `${c.name} femininos na Nidalii Store.`, alternates: { canonical: `/produtos?categoria=${c.slug}` } };
  }
  if (f.q) return { title: `Busca: ${f.q}`, robots: { index: false } };
  return { title: "Produtos", description: "Todas as peças da Nidalii Store.", alternates: { canonical: "/produtos" } };
}

export default async function ProdutosPage({ searchParams }: Props) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const category = filters.categoria.length === 1 ? await db.category.findUnique({ where: { slug: filters.categoria[0] } }) : null;
  const title = filters.q ? `“${filters.q}”` : category?.name ?? "Produtos";

  return (
    <>
      <header className="wrap pb-8 pt-8 lg:pb-12 lg:pt-14">
        <nav aria-label="Você está em" className="mb-4 text-sm text-graphite">
          <ol className="flex gap-2"><li><Link href="/">Início</Link></li><li aria-hidden="true">/</li><li aria-current="page">{category ? <Link href="/produtos">Produtos</Link> : "Produtos"}</li>{category && <><li aria-hidden="true">/</li><li>{category.name}</li></>}</ol>
        </nav>
        <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.95]">{title}</h1>
        {category?.description && <p className="mt-4 max-w-[60ch] text-lg text-graphite">{category.description}</p>}
      </header>
      <ProductListing filters={filters} basePath="/produtos" rawParams={raw} />
    </>
  );
}
