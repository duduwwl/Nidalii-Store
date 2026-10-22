"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconBag, IconHeart, IconMenu, IconSearch, IconUser } from "../icons";
import { useStore } from "./store-provider";
import { Wordmark } from "./wordmark";
import { MobileMenu } from "./mobile-menu";
import { SearchOverlay } from "./search-overlay";
import { CartDrawer } from "./cart-drawer";

export type NavCategory = { name: string; slug: string };

const NAV = [
  { href: "/produtos", label: "Produtos" },
  { href: "/colecoes", label: "Coleções" },
  { href: "/novidades", label: "Novidades" },
];

export function Header({ logoUrl, categories, announcement }: { logoUrl: string | null; categories: NavCategory[]; announcement: string | null }) {
  const { cart, openCart, favorites } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Some ao rolar para baixo, volta ao rolar para cima
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        setHidden(y > 240 && y > last + 4);
        if (y < last - 4) setHidden(false);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
      {announcement && (
        <div className="bg-ink text-white text-center text-xs tracking-[0.02em] py-2 px-4">{announcement}</div>
      )}
      <header
        className="sticky z-50 bg-paper transition-[transform,border-color] duration-300 ease-[var(--ease-soft)] border-b"
        style={{
          top: "env(safe-area-inset-top, 0px)",
          transform: hidden && !menuOpen && !searchOpen ? "translateY(-100%)" : "translateY(0)",
          borderColor: scrolled ? "var(--color-line)" : "transparent",
        }}
      >
        <div className="wrap grid h-[var(--header-h)] grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-1">
            <button type="button" className="-ml-2.5 grid size-11 place-items-center lg:hidden" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <IconMenu size={22} />
            </button>
            <nav aria-label="Principal" className="hidden lg:block">
              <ul className="flex gap-7 text-sm font-medium">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} aria-current={isActive(n.href) ? "page" : undefined}
                      className="relative py-2 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-200 hover:after:scale-x-100 aria-[current=page]:after:scale-x-100">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <Link href="/" className="justify-self-center" aria-label="Nidalii Store, página inicial">
            <Wordmark logoUrl={logoUrl} />
          </Link>

          <div className="flex items-center justify-end gap-0.5 lg:gap-1.5">
            <button type="button" className="grid size-11 place-items-center" aria-label="Buscar" onClick={() => setSearchOpen(true)}>
              <IconSearch size={21} />
            </button>
            <Link href="/favoritos" className="relative hidden size-11 place-items-center sm:grid" aria-label={`Favoritos${favorites.size ? `, ${favorites.size}` : ""}`}>
              <IconHeart size={21} filled={favorites.size > 0} />
            </Link>
            <Link href="/minha-conta" className="hidden size-11 place-items-center sm:grid" aria-label="Minha conta">
              <IconUser size={21} />
            </Link>
            <button type="button" onClick={openCart} className="-mr-2 flex h-11 items-center gap-1.5 pl-2 pr-2" aria-label={`Sacola, ${cart.count} ${cart.count === 1 ? "item" : "itens"}`}>
              <IconBag size={21} />
              {cart.count > 0 && <span className="n-dot" key={cart.count} style={{ animation: "nd-pop 320ms var(--ease-soft)" }}>{cart.count}</span>}
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} nav={NAV} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
    </>
  );
}
