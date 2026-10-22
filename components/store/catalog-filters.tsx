"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Drawer } from "../ui/drawer";
import { IconFilter } from "../icons";

export type Facets = {
  categories: { name: string; slug: string; count: number }[];
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  collections: { name: string; slug: string }[];
  hasSale: boolean;
  minPrice: number | null;
  maxPrice: number | null;
};

const SORTS: [string, string][] = [
  ["recentes", "Mais recentes"],
  ["menor-preco", "Menor preço"],
  ["maior-preco", "Maior preço"],
  ["nome", "Nome"],
  ["mais-vendidos", "Mais vendidos"],
];

function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const [pending, start] = useTransition();
  // O filtro marcado aparece na hora; a lista atualiza quando o servidor responde
  const [qsNow, setQsNow] = useOptimistic(urlParams.toString());
  const params = new URLSearchParams(qsNow);
  const push = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(qsNow);
    mut(next);
    next.delete("pagina");
    const qs = next.toString();
    start(() => {
      setQsNow(qs);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };
  const list = (k: string) => params.get(k)?.split(",").filter(Boolean) ?? [];
  const toggle = (k: string, v: string) =>
    push((p) => {
      const cur = new Set(p.get(k)?.split(",").filter(Boolean));
      if (cur.has(v)) cur.delete(v);
      else cur.add(v);
      if (cur.size) p.set(k, [...cur].join(","));
      else p.delete(k);
    });
  const set = (k: string, v: string | null) => push((p) => (v ? p.set(k, v) : p.delete(k)));
  return { params, list, toggle, set, push, pending };
}

export function SortSelect() {
  const { params, set, pending } = useFilterUrl();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ordem" className="text-sm text-graphite">Ordenar</label>
      <select id="ordem" className="select min-h-10 w-auto py-2 text-sm" value={params.get("ordem") ?? "recentes"} onChange={(e) => set("ordem", e.target.value === "recentes" ? null : e.target.value)} aria-busy={pending}>
        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

export function FilterPanel({ facets, hideCategory, hideCollection }: { facets: Facets; hideCategory?: boolean; hideCollection?: boolean }) {
  const { params, list, toggle, set, push, pending } = useFilterUrl();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const active = ["categoria", "tamanho", "cor", "colecao", "min", "max", "disponivel", "promocao"].filter((k) => params.get(k)).length;

  return (
    <div className="grid gap-8" aria-busy={pending}>
      {!hideCategory && facets.categories.length > 0 && (
        <Group title="Categoria">
          {facets.categories.map((c) => (
            <label key={c.slug} className="check">
              <input type="checkbox" checked={list("categoria").includes(c.slug)} onChange={() => toggle("categoria", c.slug)} />
              <span className="flex-1">{c.name}</span>
              <span className="price text-sm text-graphite">{c.count}</span>
            </label>
          ))}
        </Group>
      )}

      {facets.sizes.length > 0 && (
        <Group title="Tamanho">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => {
              const on = list("tamanho").includes(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => toggle("tamanho", s)}
                  className={`min-w-12 h-11 px-3 border text-sm font-medium transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                  {s}
                </button>
              );
            })}
          </div>
        </Group>
      )}

      {facets.colors.length > 0 && (
        <Group title="Cor">
          {facets.colors.map((c) => (
            <label key={c.name} className="check items-center">
              <input type="checkbox" checked={list("cor").includes(c.name)} onChange={() => toggle("cor", c.name)} />
              <span className="size-4 border border-line" style={{ background: c.hex ?? "var(--color-mist)" }} aria-hidden="true" />
              <span>{c.name}</span>
            </label>
          ))}
        </Group>
      )}

      {facets.minPrice != null && facets.maxPrice != null && facets.maxPrice > facets.minPrice && (
        <Group title="Preço">
          <form
            className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
            onSubmit={(e) => { e.preventDefault(); push((p) => { if (min) p.set("min", min); else p.delete("min"); if (max) p.set("max", max); else p.delete("max"); }); }}
          >
            <div className="field"><label htmlFor="pmin" className="!text-xs !font-normal text-graphite">Mínimo (R$)</label><input id="pmin" className="input" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} placeholder={String(Math.floor(facets.minPrice / 100))} /></div>
            <div className="field"><label htmlFor="pmax" className="!text-xs !font-normal text-graphite">Máximo (R$)</label><input id="pmax" className="input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} placeholder={String(Math.ceil(facets.maxPrice / 100))} /></div>
            <button className="btn btn-ghost btn-sm h-[3.0625rem]">Aplicar</button>
          </form>
        </Group>
      )}

      {!hideCollection && facets.collections.length > 0 && (
        <Group title="Coleção">
          {facets.collections.map((c) => (
            <label key={c.slug} className="check">
              <input type="radio" name="colecao" checked={params.get("colecao") === c.slug} onChange={() => set("colecao", c.slug)} />
              <span>{c.name}</span>
            </label>
          ))}
          {params.get("colecao") && <button type="button" className="link w-fit text-sm" onClick={() => set("colecao", null)}>Todas as coleções</button>}
        </Group>
      )}

      <Group title="Disponibilidade">
        <label className="check"><input type="checkbox" checked={params.get("disponivel") === "1"} onChange={() => set("disponivel", params.get("disponivel") ? null : "1")} /><span>Só com estoque</span></label>
        {facets.hasSale && <label className="check"><input type="checkbox" checked={params.get("promocao") === "1"} onChange={() => set("promocao", params.get("promocao") ? null : "1")} /><span>Em promoção</span></label>}
      </Group>

      {active > 0 && (
        <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => { setMin(""); setMax(""); push((p) => { for (const k of ["categoria", "tamanho", "cor", "colecao", "min", "max", "disponivel", "promocao"]) p.delete(k); }); }}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function MobileFilters({ facets, total, hideCategory, hideCollection }: { facets: Facets; total: number; hideCategory?: boolean; hideCollection?: boolean }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const active = ["categoria", "tamanho", "cor", "colecao", "min", "max", "disponivel", "promocao"].filter((k) => params.get(k)).length;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm lg:hidden" aria-expanded={open}>
        <IconFilter size={18} /> Filtrar{active ? ` (${active})` : ""}
      </button>
      <Drawer
        open={open} onClose={() => setOpen(false)} title="Filtrar" side="left" width="min(26rem, 92vw)"
        footer={<button type="button" className="btn btn-solid btn-block" onClick={() => setOpen(false)}>Ver {total} {total === 1 ? "produto" : "produtos"}</button>}
      >
        <div className="p-5"><FilterPanel facets={facets} hideCategory={hideCategory} hideCollection={hideCollection} /></div>
      </Drawer>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}
