"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { IconArrow } from "../icons";

type Look = { id: string; url: string; alt: string; name: string; slug: string; priceCents: number };

/**
 * Vitrine de looks: as fotos editoriais da loja passam numa fileira com encaixe.
 * A foto em foco cresce; a legenda mostra a peça e leva direto a ela.
 */
export function Lookbook({ looks }: { looks: Look[] }) {
  const rail = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-i]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { root: el, threshold: 0.6 },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);

  const go = (dir: 1 | -1) => {
    const el = rail.current;
    const next = Math.max(0, Math.min(looks.length - 1, active + dir));
    (el?.children[next] as HTMLElement | undefined)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  const current = looks[active] ?? looks[0];

  return (
    <section aria-labelledby="looks-t" className="mt-[var(--section)] overflow-hidden bg-mist py-14 lg:py-20">
      <div className="wrap mb-8 grid gap-4 lg:grid-cols-12 lg:items-end">
        <h2 id="looks-t" className="font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] lg:col-span-6">Vitrine de looks</h2>
        <div className="flex items-end justify-between gap-6 lg:col-span-5 lg:col-start-8">
          <p className="min-h-[3.25rem] text-graphite" aria-live="polite">
            <Link href={`/produtos/${current.slug}`} className="block font-medium text-ink">{current.name}</Link>
            <span className="price">{formatCents(current.priceCents)}</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="grid size-11 place-items-center border border-ink disabled:opacity-30" onClick={() => go(-1)} disabled={active === 0} aria-label="Look anterior"><IconArrow dir="left" size={18} /></button>
            <button type="button" className="grid size-11 place-items-center border border-ink disabled:opacity-30" onClick={() => go(1)} disabled={active === looks.length - 1} aria-label="Próximo look"><IconArrow size={18} /></button>
          </div>
        </div>
      </div>
      <ul
        ref={rail}
        className="flex gap-3 overflow-x-auto overscroll-x-contain px-[max(var(--margin),env(safe-area-inset-left,0px))] [scroll-snap-type:x_mandatory] [scrollbar-width:none] lg:gap-5"
        style={{ scrollPaddingInline: "var(--margin)" }}
      >
        {looks.map((l, i) => (
          <li key={l.id} data-i={i} className="w-[72vw] shrink-0 [scroll-snap-align:start] sm:w-[44vw] lg:w-[30vw]">
            <Link href={`/produtos/${l.slug}`} className="block" aria-label={l.name}>
              <span
                className="photo block origin-bottom transition-[transform,opacity] duration-500 ease-[var(--ease-soft)]"
                style={{ transform: i === active ? "scale(1)" : "scale(0.94)", opacity: i === active ? 1 : 0.7 }}
              >
                <Image src={l.url} alt={l.alt} fill sizes="(min-width:1024px) 30vw, 72vw" loading="lazy" />
              </span>
            </Link>
          </li>
        ))}
        <li aria-hidden="true" className="w-px shrink-0" />
      </ul>
    </section>
  );
}
