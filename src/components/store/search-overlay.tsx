"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconSearch } from "../icons";
import { quickSearchAction, type SearchHit } from "@/app/actions/catalog";
import { formatCents } from "@/lib/money";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await quickSearchAction(term);
      setHits(r.hits); setTotal(r.total); setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;
  const term = q.trim();
  const visible = term.length >= 2 ? hits : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Buscar produtos" className="fixed inset-0 z-[80] bg-paper overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="wrap py-5 lg:py-10">
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); if (term) { router.push(`/produtos?q=${encodeURIComponent(term)}`); onClose(); } }}
          className="flex items-center gap-3 border-b border-ink pb-3 focus-within:shadow-[0_1px_0_0_var(--color-ink)]"
        >
          <IconSearch size={24} />
          <label htmlFor="busca" className="sr-only">Buscar</label>
          <input
            ref={input} id="busca" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar vestidos, blusas, conjuntos…" autoComplete="off" spellCheck={false} enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent font-display text-[1.75rem] outline-none placeholder:text-graphite/60 lg:text-[2.75rem]"
          />
          <button type="button" onClick={onClose} className="grid size-11 place-items-center" aria-label="Fechar busca"><IconClose size={24} /></button>
        </form>

        <div className="mt-8" aria-live="polite">
          {term.length >= 2 && !loading && visible.length === 0 && (
            <p className="text-graphite">Nada encontrado para “{term}”. Tente outra palavra ou veja <Link href="/produtos" onClick={onClose} className="link">todos os produtos</Link>.</p>
          )}
          {visible.length > 0 && (
            <>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                {visible.map((h) => (
                  <li key={h.id}>
                    <Link href={`/produtos/${h.slug}`} onClick={onClose} className="grid gap-2">
                      <span className="photo block">
                        {h.image ? <Image src={h.image.url} alt={h.image.alt} fill sizes="(min-width:1024px) 16vw, 50vw" /> : <span className="photo-empty">Sem foto</span>}
                      </span>
                      <span className="text-sm leading-snug">{h.name}</span>
                      <span className="price text-sm text-graphite">{formatCents(h.priceCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {total > visible.length && (
                <Link href={`/produtos?q=${encodeURIComponent(term)}`} onClick={onClose} className="btn btn-ghost mt-8">
                  Ver os {total} resultados
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
