"use client";

import { useActionState, useState, useTransition } from "react";
import { adjustStockAction, deleteVariantAction, generateVariantsAction, updateVariantAction } from "@/app/admin/actions/products";
import { centsToInput } from "@/lib/money";
import { FormMessage, Submit } from "../ui/form";

type V = { id: string; sku: string; colorName: string | null; colorHex: string | null; size: string | null; priceCents: number | null; stock: number; reserved: number; lowStockAt: number; isActive: boolean };

export function VariantManager({ productId, variants, basePriceCents }: { productId: string; variants: V[]; basePriceCents: number | null }) {
  const [state, action] = useActionState(generateVariantsAction.bind(null, productId), null);
  return (
    <section className="grid gap-5 bg-white p-5 lg:p-6" aria-labelledby="var-t">
      <div>
        <h2 id="var-t" className="text-lg font-medium">Cores, tamanhos e estoque</h2>
        <p className="hint mt-1">Cada combinação de cor e tamanho tem estoque próprio. A cliente só consegue comprar o que tem saldo.</p>
      </div>

      <FormMessage state={state} />
      <details open={variants.length === 0 || undefined} className="border border-dashed border-line p-4">
        <summary className="cursor-pointer font-medium">Criar variantes</summary>
        <form action={action} className="mt-4 grid gap-4">
          <div className="field">
            <label htmlFor="colors">Cores, uma por linha</label>
            <textarea id="colors" name="colors" className="textarea !min-h-20" placeholder={"Preto|#111111\nOff-white|#F2EEE6"} />
            <p className="hint">Opcional: depois de “|”, o código da cor para a amostra. Sem cores, deixe em branco.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="sizes">Tamanhos</label>
              <input id="sizes" name="sizes" className="input" placeholder="P M G GG ou 36 38 40" />
            </div>
            <div className="field">
              <label htmlFor="initialStock">Estoque inicial de cada</label>
              <input id="initialStock" name="initialStock" type="number" min={0} className="input" defaultValue={0} />
            </div>
          </div>
          <Submit className="btn btn-solid w-fit" pendingText="Criando…">Criar combinações</Submit>
        </form>
      </details>

      {variants.length > 0 && (
        <ul className="grid gap-3">
          {variants.map((v) => <VariantRow key={v.id} v={v} basePriceCents={basePriceCents} />)}
        </ul>
      )}
    </section>
  );
}

function VariantRow({ v, basePriceCents }: { v: V; basePriceCents: number | null }) {
  const [state, action] = useActionState(updateVariantAction.bind(null, v.id), null);
  const [stockState, stockAction] = useActionState(adjustStockAction.bind(null, v.id), null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const free = v.stock - v.reserved;

  return (
    <li className={`border border-line ${v.isActive ? "" : "opacity-60"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 p-3 text-left text-sm">
        <span className="size-5 border border-line" style={{ background: v.colorHex ?? "var(--color-mist)" }} aria-hidden="true" />
        <span><span className="font-medium">{[v.colorName, v.size].filter(Boolean).join(" · ") || "Variante única"}</span><span className="block text-xs text-graphite">{v.sku}{!v.isActive && " · desativada"}</span></span>
        <span className={`price text-right ${free <= 0 ? "text-wine" : free <= v.lowStockAt ? "text-wine" : ""}`}>
          {free} {free === 1 ? "disponível" : "disponíveis"}{v.reserved > 0 && <span className="block text-xs text-graphite">{v.reserved} reservada{v.reserved === 1 ? "" : "s"}</span>}
        </span>
      </button>
      {open && (
        <div className="grid gap-5 border-t border-line p-4">
          <form action={stockAction} className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
            <div className="field"><label htmlFor={`d-${v.id}`}>Quantidade</label><input id={`d-${v.id}`} name="delta" type="number" className="input" placeholder="+5 ou -2" required /></div>
            <div className="field">
              <label htmlFor={`r-${v.id}`}>Motivo</label>
              <select id={`r-${v.id}`} name="reason" className="select"><option value="RESTOCK">Entrada / reposição</option><option value="ADJUSTMENT">Ajuste (contagem)</option><option value="RETURN">Devolução</option></select>
            </div>
            <div className="field"><label htmlFor={`n-${v.id}`}>Observação</label><input id={`n-${v.id}`} name="note" className="input" /></div>
            <Submit className="btn btn-solid btn-sm h-[3.0625rem]" pendingText="…">Lançar</Submit>
            <div className="sm:col-span-4"><FormMessage state={stockState} /></div>
          </form>

          <form action={action} className="grid gap-3 sm:grid-cols-3">
            <FormMessage state={state} />
            <div className="field"><label htmlFor={`c-${v.id}`}>Cor</label><input id={`c-${v.id}`} name="colorName" className="input" defaultValue={v.colorName ?? ""} /></div>
            <div className="field"><label htmlFor={`h-${v.id}`}>Código da cor</label><input id={`h-${v.id}`} name="colorHex" className="input" defaultValue={v.colorHex ?? ""} placeholder="#000000" /></div>
            <div className="field"><label htmlFor={`s-${v.id}`}>Tamanho</label><input id={`s-${v.id}`} name="size" className="input" defaultValue={v.size ?? ""} /></div>
            <div className="field"><label htmlFor={`k-${v.id}`}>SKU</label><input id={`k-${v.id}`} name="sku" className="input" defaultValue={v.sku} /></div>
            <div className="field"><label htmlFor={`p-${v.id}`}>Preço próprio (R$)</label><input id={`p-${v.id}`} name="price" className="input" inputMode="decimal" defaultValue={centsToInput(v.priceCents)} placeholder={basePriceCents != null ? centsToInput(basePriceCents) : "do produto"} /></div>
            <div className="field"><label htmlFor={`l-${v.id}`}>Alerta de estoque baixo</label><input id={`l-${v.id}`} name="lowStockAt" type="number" min={0} className="input" defaultValue={v.lowStockAt} /></div>
            <label className="check text-sm sm:col-span-3"><input type="checkbox" name="isActive" defaultChecked={v.isActive} /><span>Ativa (aparece na loja)</span></label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Submit className="btn btn-ghost btn-sm">Salvar variante</Submit>
              <button type="button" className="text-sm text-wine underline underline-offset-4" disabled={pending} onClick={() => start(async () => { const r = await deleteVariantAction(v.id); setDelMsg(r?.message ?? r?.error ?? null); })}>Excluir</button>
              {delMsg && <span className="text-sm text-graphite">{delMsg}</span>}
            </div>
          </form>
        </div>
      )}
    </li>
  );
}
