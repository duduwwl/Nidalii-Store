import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { getCartSummary } from "@/server/cart";
import { sellable } from "@/server/catalog";
import { toClientCart } from "@/lib/client-cart";
import { StoreProvider } from "@/components/store/store-provider";
import { Header } from "@/components/store/header";
import { Footer } from "@/components/store/footer";
import { RevealObserver } from "@/components/store/reveal";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, cart, user, categories] = await Promise.all([
    getSettings(),
    getCartSummary(),
    currentUser(),
    db.category.findMany({
      where: { isVisible: true, products: { some: sellable() } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { name: true, slug: true },
    }),
  ]);
  const favorites = user?.customer
    ? (await db.wishlistItem.findMany({ where: { wishlist: { customerId: user.customer.id } }, select: { productId: true } })).map((w) => w.productId)
    : [];

  return (
    <StoreProvider initialCart={toClientCart(cart)} loggedIn={!!user?.customer} serverFavorites={favorites}>
      <Header logoUrl={settings.logoUrl} categories={categories} announcement={settings.announcementText} />
      <main id="conteudo" tabIndex={-1} className="outline-none">{children}</main>
      <Footer settings={settings} categories={categories} />
      <RevealObserver />
    </StoreProvider>
  );
}
