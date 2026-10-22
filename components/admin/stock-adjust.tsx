"use client";

import { useActionState } from "react";
import { adjustStockAction } from "@/app/admin/actions/products";

/** Entrada rápida na tabela de estoque: número positivo soma, negativo subtrai. */
export function StockAdjust({ variantId }: { variantId: string }) {
  const [state, action, pending] = useActionState(adjustStockAction.bind(null, variantId), null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="reason" value="RESTOCK" />
      <label htmlFor={`q-${variantId}`} className="sr-only">Quantidade a lançar</label>
      <input id={`q-${variantId}`} name="delta" type="number" className="input w-20 !py-1.5" placeholder="+0" required />
      <button className="btn btn-ghost btn-sm" disabled={pending}>{pending ? "…" : "Ok"}</button>
      {state?.error && <span className="error max-w-40">{state.error}</span>}
      {state?.ok && <span className="text-xs text-ok">{state.message}</span>}
    </form>
  );
}
