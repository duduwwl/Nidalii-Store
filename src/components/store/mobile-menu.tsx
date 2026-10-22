"use client";

import Link from "next/link";
import { Drawer } from "../ui/drawer";
import type { NavCategory } from "./header";

export function MobileMenu({
  open, onClose, categories, nav,
}: { open: boolean; onClose: () => void; categories: NavCategory[]; nav: { href: string; label: string }[] }) {
  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left" width="min(24rem, 88vw)">
      <nav aria-label="Menu" className="grid gap-10 px-5 py-8">
        <ul className="grid gap-3">
          {nav.map((n) => (
            <li key={n.href}>
              <Link href={n.href} onClick={onClose} className="font-display text-[2.25rem] leading-tight">{n.label}</Link>
            </li>
          ))}
        </ul>
        {categories.length > 0 && (
          <div className="grid gap-3">
            <p className="text-sm text-graphite">Categorias</p>
            <ul className="grid gap-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/produtos?categoria=${c.slug}`} onClick={onClose} className="text-lg">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="grid gap-2.5 border-t border-line pt-6 text-[1.0625rem]">
          <li><Link href="/favoritos" onClick={onClose}>Favoritos</Link></li>
          <li><Link href="/minha-conta" onClick={onClose}>Minha conta</Link></li>
          <li><Link href="/entregas" onClick={onClose}>Entregas e retirada</Link></li>
          <li><Link href="/contato" onClick={onClose}>Atendimento</Link></li>
        </ul>
      </nav>
    </Drawer>
  );
}
