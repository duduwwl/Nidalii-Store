"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconClose, IconMenu } from "../icons";

const GROUPS: { title: string; items: { href: string; label: string; admin?: boolean }[] }[] = [
  { title: "Vendas", items: [{ href: "/admin", label: "Visão geral" }, { href: "/admin/pedidos", label: "Pedidos" }, { href: "/admin/clientes", label: "Clientes" }, { href: "/admin/relatorios", label: "Relatórios" }] },
  { title: "Catálogo", items: [{ href: "/admin/produtos", label: "Produtos" }, { href: "/admin/estoque", label: "Estoque" }, { href: "/admin/categorias", label: "Categorias" }, { href: "/admin/colecoes", label: "Coleções" }] },
  { title: "Loja", items: [{ href: "/admin/banners", label: "Banners e home" }, { href: "/admin/cupons", label: "Cupons" }, { href: "/admin/fretes", label: "Frete e retirada", admin: true }, { href: "/admin/configuracoes", label: "Configurações", admin: true }] },
];

export function AdminNav({ role, name, pendingOrders, signOut }: { role: string; name: string; pendingOrders: number; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isOn = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  const nav = (
    <nav aria-label="Painel" className="grid content-start gap-7">
      {GROUPS.map((g) => (
        <div key={g.title} className="grid gap-1">
          <p className="mb-1 text-xs text-graphite">{g.title}</p>
          {g.items.filter((i) => !i.admin || role === "ADMIN").map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} aria-current={isOn(i.href) ? "page" : undefined}
              className={`flex items-center justify-between px-3 py-2 text-[0.9375rem] transition-colors ${isOn(i.href) ? "bg-ink text-white" : "hover:bg-mist"}`}>
              {i.label}
              {i.href === "/admin/pedidos" && pendingOrders > 0 && <span className={`price text-xs ${isOn(i.href) ? "text-white" : "text-wine"}`}>{pendingOrders}</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="-ml-2 grid size-11 place-items-center" aria-label="Abrir menu do painel"><IconMenu size={22} /></button>
        <span className="font-display tracking-[0.18em]">NIDALII</span>
        <Link href="/" className="text-sm underline underline-offset-4">Ver loja</Link>
      </header>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-white px-4 py-6 lg:flex">
        <Link href="/admin" className="px-3 font-display text-[1.375rem] tracking-[0.18em]">NIDALII</Link>
        {nav}
        <div className="mt-auto grid gap-2 border-t border-line px-3 pt-4 text-sm">
          <p className="truncate text-graphite">{name}</p>
          <Link href="/" target="_blank" className="underline underline-offset-4">Ver loja</Link>
          <form action={signOut}><button className="underline underline-offset-4">Sair</button></form>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white px-4 py-4 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <div className="mb-6 flex items-center justify-between">
            <span className="font-display tracking-[0.18em]">NIDALII</span>
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center" aria-label="Fechar"><IconClose size={22} /></button>
          </div>
          {nav}
          <form action={signOut} className="mt-8 border-t border-line pt-4"><button className="underline underline-offset-4">Sair</button></form>
        </div>
      )}
    </>
  );
}
