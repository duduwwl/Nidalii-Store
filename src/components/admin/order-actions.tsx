"use client";

import { useActionState, useState, useTransition } from "react";
import { changeStatusAction, refundAction, saveTrackingAction } from "@/app/admin/actions/store";
import { FormMessage, Submit, TextField } from "../ui/form";

export function OrderActions({
  orderId, next, fulfillment, trackingCode, carrier, canRefund,
}: { orderId: string; next: { value: string; label: string }[]; fulfillment: "DELIVERY" | "PICKUP"; trackingCode: string; carrier: string; canRefund: boolean }) {
  const [state, action] = useActionState(changeStatusAction.bind(null, orderId), null);
  const [tState, tAction] = useActionState(saveTrackingAction.bind(null, orderId), null);
  const [to, setTo] = useState(next[0]?.value ?? "");
  const [refundMsg, setRefundMsg] = useState<{ error?: string; message?: string } | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="grid gap-5 border border-ink bg-white p-5 lg:p-6" aria-labelledby="acoes-t">
      <h2 id="acoes-t" className="text-lg font-medium">Próximo passo</h2>
      {next.length === 0 ? (
        <p className="text-sm text-graphite">Este pedido não tem mais mudanças de situação.</p>
      ) : (
        <form action={action} className="grid gap-4">
          <FormMessage state={state} />
          <div className="field">
            <label htmlFor="status">Mudar para</label>
            <select id="status" name="status" className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              {next.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {to === "SHIPPED" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="trackingCode" label="Código de rastreio" defaultValue={trackingCode} required error={state?.fieldErrors?.trackingCode} />
              <TextField name="carrier" label="Transportadora" defaultValue={carrier} />
            </div>
          )}
          {to === "CANCELED" && <p className="text-sm text-wine">Cancelar devolve as peças ao estoque. Se o pedido já foi pago, faça também o estorno.</p>}
          <TextField name="note" label="Anotação interna (opcional)" />
          <label className="check text-sm"><input type="checkbox" name="notify" defaultChecked /><span>Avisar a cliente por e-mail</span></label>
          <Submit className="btn btn-solid w-fit" pendingText="Atualizando…">Atualizar pedido</Submit>
        </form>
      )}

      {fulfillment === "DELIVERY" && (
        <form action={tAction} className="grid gap-3 border-t border-line pt-5">
          <p className="text-sm font-medium">Rastreio</p>
          <FormMessage state={tState} />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <TextField name="trackingCode" label="Código" defaultValue={trackingCode} id="tc2" />
            <TextField name="carrier" label="Transportadora" defaultValue={carrier} id="cr2" />
            <Submit className="btn btn-ghost btn-sm h-[3.0625rem]">Salvar</Submit>
          </div>
        </form>
      )}

      {canRefund && (
        <div className="grid gap-3 border-t border-line pt-5">
          {refundMsg && <FormMessage state={refundMsg} />}
          {confirmRefund ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm !border-wine !bg-wine text-white" disabled={pending} onClick={() => start(async () => { setRefundMsg(await refundAction(orderId)); setConfirmRefund(false); })}>{pending ? "Estornando…" : "Confirmar estorno total"}</button>
              <button type="button" className="text-sm underline" onClick={() => setConfirmRefund(false)}>Cancelar</button>
            </div>
          ) : (
            <button type="button" className="w-fit text-sm text-wine underline underline-offset-4" onClick={() => setConfirmRefund(true)}>Estornar pagamento</button>
          )}
        </div>
      )}
    </section>
  );
}
