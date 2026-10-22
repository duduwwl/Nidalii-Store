"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productsByIdsAction } from "@/app/actions/catalog";
import { ProductCard, type CardData } from "./product-card";
import { useStore } from "./store-provider";

function toCard(p: Awaited<ReturnType<typeof productsByIdsAction>>[number]): CardData {
  const colors = new Map<string, string | null>();
  const sizes = new Set<string>();
  let free = 0;
  for (const v of p.variants) {
    if (v.colorName && !colors.has(v.colorName)) colors.set(v.colorName, v.colorHex);
    const a = Math.max(0, v.stock - v.reserved);
    if (v.size && a > 0) sizes.add(v.size);
    free += a;
  }
  return {
    id: p.id, name: p.name, slug: p.slug, priceCents: p.priceCents ?? 0, compareAtCents: p.compareAtCents,
    images: p.images.slice(0, 2).map((i) => ({ url: i.url, alt: i.alt })),
    colors: [...colors].map(([name, hex]) => ({ name, hex })), sizes: [...sizes], soldOut: free === 0, isNew: false,
  };
}

export function FavoritesGrid({ serverItems }: { serverItems: CardData[] | null }) {
  const { favorites, loggedIn } = useStore();
  const [guestItems, setGuestItems] = useState<CardData[] | null>(null);
  const ids = [...favorites].sort().join(",");

  useEffect(() => {
    if (serverItems || !ids) return;
    let live = true;
    productsByIdsAction(ids.split(",")).then((list) => live && setGuestItems(list.map(toCard)));
    return () => { live = false; };
  }, [serverItems, ids]);

  const items = serverItems ? serverItems.filter((p) => favorites.has(p.id)) : !ids ? [] : guestItems?.filter((p) => favorites.has(p.id));
  if (items == null) return <p className="text-graphite">Carregando…</p>;
  if (items.length === 0) {
    return (
      <div className="grid justify-items-start gap-5">
        <p className="text-lg text-graphite">Você ainda não favoritou nenhuma peça. Toque no coração de um produto para guardar aqui.</p>
        <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
      </div>
    );
  }
  return (
    <>
      {!loggedIn && <p className="mb-8 text-sm text-graphite">Seus favoritos ficam salvos neste aparelho. <Link href="/entrar?voltar=/favoritos" className="link">Entre na conta</Link> para vê-los em qualquer lugar.</p>}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-4">
        {items.map((p) => <li key={p.id}><ProductCard p={p} /></li>)}
      </ul>
    </>
  );
}
