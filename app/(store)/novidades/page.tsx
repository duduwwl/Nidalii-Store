import type { Metadata } from "next";
import { parseFilters } from "@/server/catalog";
import { ProductListing } from "@/components/store/product-listing";

export const metadata: Metadata = { title: "Novidades", description: "As peças que acabaram de chegar na Nidalii Store.", alternates: { canonical: "/novidades" } };

export default async function NovidadesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filters = { ...parseFilters(raw), ordem: parseFilters(raw).ordem ?? ("recentes" as const) };
  return (
    <>
      <header className="wrap pb-8 pt-8 lg:pb-12 lg:pt-14">
        <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.95]">Novidades</h1>
        <p className="mt-4 max-w-[52ch] text-lg text-graphite">O que acabou de chegar, das mais recentes para as mais antigas.</p>
      </header>
      <ProductListing filters={filters} basePath="/novidades" rawParams={raw} emptyText="As novidades aparecem aqui assim que chegarem." />
    </>
  );
}
