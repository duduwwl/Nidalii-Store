"use client";

import Image from "next/image";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { IconHeart } from "../icons";
import { useStore } from "./store-provider";

export type CardData = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtCents: number | null;
  images: { url: string; alt: string }[];
  colors: { name: string; hex: string | null }[];
  sizes: string[];
  soldOut: boolean;
  isNew: boolean;
};

export function ProductCard({ p, priority = false, sizes }: { p: CardData; priority?: boolean; sizes?: string }) {
  const { favorites, toggleFavorite } = useStore();
  const fav = favorites.has(p.id);
  const [first, second] = p.images;
  const onSale = p.compareAtCents != null && p.compareAtCents > p.priceCents;

  return (
    <article className="group relative grid content-start gap-3">
      <Link href={`/produtos/${p.slug}`} className="photo block" aria-label={p.name}>
        {first ? (
          <>
            <Image src={first.url} alt={first.alt} fill priority={priority} sizes={sizes ?? "(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"} />
            {second && (
              <Image
                src={second.url} alt="" fill aria-hidden="true" sizes={sizes ?? "(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"}
                className="opacity-0 transition-opacity duration-300 ease-[var(--ease-soft)] [@media(hover:hover)]:group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <span className="photo-empty absolute inset-0">Foto em breve</span>
        )}
        {p.soldOut && <span className="absolute bottom-2.5 left-2.5 bg-white px-2 py-1 text-xs">Esgotado</span>}
        {!p.soldOut && onSale && <span className="absolute bottom-2.5 left-2.5 bg-white px-2 py-1 text-xs text-wine">Promoção</span>}
      </Link>
      <button
        type="button"
        onClick={() => toggleFavorite(p.id)}
        aria-pressed={fav}
        aria-label={fav ? `Remover ${p.name} dos favoritos` : `Favoritar ${p.name}`}
        className="absolute right-1 top-1 grid size-11 place-items-center transition-transform active:scale-90"
      >
        <IconHeart size={20} filled={fav} />
      </button>
      <div className="grid gap-1 text-sm">
        {/* a linha de cores sempre ocupa o mesmo espaço, para os nomes ficarem alinhados na grade */}
        <ul className="mb-0.5 flex h-3 gap-1.5" aria-label={p.colors.length > 1 ? `${p.colors.length} cores` : undefined} aria-hidden={p.colors.length > 1 ? undefined : true}>
          {p.colors.length > 1 && p.colors.slice(0, 6).map((c) => (
            <li key={c.name} title={c.name} className="size-3 border border-line" style={{ background: c.hex ?? "var(--color-mist)" }} />
          ))}
        </ul>
        <Link href={`/produtos/${p.slug}`} className="leading-snug">{p.name}</Link>
        <p className="price">
          {onSale ? (
            <>
              <s className="mr-2 text-graphite">{formatCents(p.compareAtCents!)}</s>
              <span className="text-wine">{formatCents(p.priceCents)}</span>
            </>
          ) : (
            <span className="text-graphite">{formatCents(p.priceCents)}</span>
          )}
        </p>
        {p.sizes.length > 0 && (
          <p className="flex flex-wrap gap-x-2 text-xs text-graphite" aria-label={`Tamanhos disponíveis: ${p.sizes.join(", ")}`}>
            {p.sizes.map((s) => <span key={s}>{s}</span>)}
          </p>
        )}
      </div>
    </article>
  );
}
