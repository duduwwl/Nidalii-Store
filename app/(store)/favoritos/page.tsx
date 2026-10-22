import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { cardInclude, sellable } from "@/server/catalog";
import { toCardData } from "@/server/card-data";
import { FavoritesGrid } from "@/components/store/favorites-grid";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default async function FavoritosPage() {
  const user = await currentUser();
  const items = user?.customer
    ? await db.product.findMany({
        where: { ...sellable(), wishlistItems: { some: { wishlist: { customerId: user.customer.id } } } },
        include: cardInclude,
      })
    : null; // visitante: a lista vem do navegador

  return (
    <div className="wrap pt-8 lg:pt-14">
      <h1 className="mb-10 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.95]">Favoritos</h1>
      <FavoritesGrid serverItems={items ? items.map(toCardData) : null} />
    </div>
  );
}
