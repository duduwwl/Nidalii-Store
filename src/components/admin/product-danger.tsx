"use client";

import { useState, useTransition } from "react";
import { archiveProductAction, deleteProductAction } from "@/app/admin/actions/products";

export function ProductDanger({ productId, archived }: { productId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="mt-10 grid gap-3 border-t border-line pt-6" aria-label="Arquivar ou excluir">
      <div className="flex flex-wrap items-center gap-3">
        {!archived && <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => archiveProductAction(productId))}>Arquivar (tirar da loja)</button>}
        {confirm ? (
          <>
            <button type="button" className="btn btn-sm !border-wine !bg-wine text-white" disabled={pending} onClick={() => start(async () => { const r = await deleteProductAction(productId); if (r?.error) setMsg(r.error); })}>Excluir definitivamente</button>
            <button type="button" className="text-sm underline" onClick={() => setConfirm(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" className="text-sm text-wine underline underline-offset-4" onClick={() => setConfirm(true)}>Excluir produto</button>
        )}
      </div>
      {msg && <p className="error" role="alert">{msg}</p>}
      <p className="hint">Produtos já vendidos não podem ser excluídos, para manter o histórico dos pedidos. Arquive-os.</p>
    </section>
  );
}
