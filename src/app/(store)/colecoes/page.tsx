import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCollections } from "@/server/catalog";

export const metadata: Metadata = { title: "Coleções", description: "As coleções da Nidalii Store.", alternates: { canonical: "/colecoes" } };

export default async function ColecoesPage() {
  const collections = await getCollections();
  return (
    <div className="wrap pt-8 lg:pt-14">
      <h1 className="mb-10 font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] lg:mb-16">Coleções</h1>
      {collections.length === 0 ? (
        <p className="py-10 text-lg text-graphite">As coleções aparecem aqui assim que forem montadas.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-14 md:grid-cols-2">
          {collections.map((c, i) => {
            const cover = c.coverImage ?? c.products[0]?.product.images[0]?.url;
            return (
              <li key={c.id} className={i % 2 === 1 ? "md:mt-24" : ""}>
                <Link href={`/colecoes/${c.slug}`} className="group grid gap-4">
                  <span className="photo block aspect-[4/5]">
                    {cover ? <Image src={cover} alt="" fill sizes="(min-width:768px) 50vw, 100vw" className="transition-transform duration-700 ease-[var(--ease-soft)] [@media(hover:hover)]:group-hover:scale-[1.03]" /> : <span className="photo-empty absolute inset-0" />}
                  </span>
                  <span className="flex items-baseline justify-between gap-4">
                    <span className="font-display text-[2.25rem] italic leading-none">{c.name}</span>
                    <span className="text-sm text-graphite">{c._count.products} {c._count.products === 1 ? "peça" : "peças"}</span>
                  </span>
                  {c.description && <span className="max-w-[48ch] text-graphite">{c.description}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
