import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseFilters } from "@/server/catalog";
import { ProductListing } from "@/components/store/product-listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(slug: string) {
  return db.collection.findFirst({ where: { slug, isVisible: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  if (!c) return {};
  return {
    title: c.name,
    description: c.description ?? `Coleção ${c.name} da Nidalii Store.`,
    alternates: { canonical: `/colecoes/${c.slug}` },
    openGraph: c.coverImage ? { images: [c.coverImage] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await load(slug);
  if (!c) notFound();
  const raw = await searchParams;
  const filters = { ...parseFilters(raw), colecao: c.slug };

  return (
    <>
      <header className="wrap grid gap-6 pb-10 pt-8 lg:grid-cols-12 lg:items-end lg:pb-14 lg:pt-14">
        <div className="lg:col-span-6">
          <nav aria-label="Você está em" className="mb-4 text-sm text-graphite"><Link href="/colecoes">Coleções</Link></nav>
          <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] italic leading-[0.95]">{c.name}</h1>
          {c.description && <p className="mt-5 max-w-[52ch] text-lg text-graphite">{c.description}</p>}
        </div>
        {c.coverImage && (
          <div className="photo aspect-[16/10] lg:col-span-5 lg:col-start-8">
            <Image src={c.coverImage} alt="" fill priority sizes="(min-width:1024px) 42vw, 100vw" />
          </div>
        )}
      </header>
      <ProductListing filters={filters} basePath={`/colecoes/${c.slug}`} rawParams={raw} hideCollection />
    </>
  );
}
