"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/minha-conta", label: "Dados pessoais" },
  { href: "/minha-conta/pedidos", label: "Meus pedidos" },
  { href: "/minha-conta/enderecos", label: "Endereços" },
  { href: "/favoritos", label: "Favoritos" },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Minha conta" className="mt-6">
      <ul className="flex gap-5 overflow-x-auto border-b border-line pb-3 lg:grid lg:gap-2 lg:border-0 lg:pb-0">
        {ITEMS.map((i) => {
          const on = i.href === "/minha-conta" ? path === i.href : path.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link href={i.href} aria-current={on ? "page" : undefined} className={`py-1 ${on ? "font-medium underline underline-offset-4" : "text-graphite"}`}>{i.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
