"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, deleteAddressAction, saveAddressAction, updateProfileAction } from "@/app/actions/account";
import { lookupCepAction } from "@/app/actions/cart";
import { maskCEP, maskCPF, maskPhone, UFS } from "@/lib/br";
import { FormMessage, Submit, TextField } from "../ui/form";

export function ProfileForm(p: { email: string; fullName: string; cpf: string; phone: string; marketing: boolean }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const [cpf, setCpf] = useState(p.cpf);
  const [phone, setPhone] = useState(p.phone);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid max-w-2xl gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <TextField name="fullName" label="Nome completo" defaultValue={p.fullName} autoComplete="name" error={fe.fullName} className="sm:col-span-2" />
      <TextField name="email" label="E-mail" defaultValue={p.email} readOnly hint="Para trocar o e-mail, fale com a loja." className="sm:col-span-2" />
      <TextField name="cpf" label="CPF" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} inputMode="numeric" error={fe.cpf} />
      <TextField name="phone" label="Celular com DDD" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="tel" autoComplete="tel-national" error={fe.phone} />
      <label className="check text-sm sm:col-span-2"><input type="checkbox" name="marketing" defaultChecked={p.marketing} /><span>Quero receber novidades e promoções por e-mail.</span></label>
      <div className="sm:col-span-2"><Submit>Salvar dados</Submit></div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, null);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost w-fit">Excluir minha conta</button>;
  return (
    <form action={action} className="grid max-w-md gap-4">
      <TextField name="confirm" label="Digite EXCLUIR para confirmar" autoComplete="off" error={state?.fieldErrors?.confirm} />
      <div className="flex gap-3">
        <Submit className="btn btn-solid !bg-wine !border-wine" pendingText="Excluindo…">Excluir definitivamente</Submit>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}

type Addr = { id: string; label: string | null; recipient: string; cep: string; street: string; number: string; complement: string | null; neighborhood: string; city: string; state: string; reference: string | null; isDefault: boolean };

export function AddressForm({ address, onDone }: { address?: Addr; onDone?: () => void }) {
  const [state, action] = useActionState(async (prev: Parameters<typeof saveAddressAction>[0], fd: FormData) => {
    const r = await saveAddressAction(prev, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  const fe = state?.fieldErrors ?? {};
  const [v, setV] = useState({
    cep: address ? maskCEP(address.cep) : "", street: address?.street ?? "", neighborhood: address?.neighborhood ?? "",
    city: address?.city ?? "", state: address?.state ?? "",
  });
  async function onCep(value: string) {
    const masked = maskCEP(value);
    setV((p) => ({ ...p, cep: masked }));
    if (masked.replace(/\D/g, "").length === 8) {
      const r = await lookupCepAction(masked);
      if (r.ok) setV((p) => ({ ...p, street: r.address.street || p.street, neighborhood: r.address.neighborhood || p.neighborhood, city: r.address.city || p.city, state: r.address.state || p.state }));
    }
  }
  return (
    <form action={action} className="grid gap-4 bg-white p-5 sm:grid-cols-6">
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="sm:col-span-6"><FormMessage state={state && !state.fieldErrors ? state : null} /></div>
      <TextField name="label" label="Apelido (opcional)" placeholder="Casa, trabalho…" defaultValue={address?.label ?? ""} className="sm:col-span-2" />
      <TextField name="recipient" label="Quem recebe" defaultValue={address?.recipient ?? ""} error={fe.recipient} className="sm:col-span-4" />
      <TextField name="cep" label="CEP" value={v.cep} onChange={(e) => onCep(e.target.value)} inputMode="numeric" autoComplete="postal-code" error={fe.cep} className="sm:col-span-2" />
      <TextField name="street" label="Rua" value={v.street} onChange={(e) => setV({ ...v, street: e.target.value })} error={fe.street} className="sm:col-span-4" />
      <TextField name="number" label="Número" defaultValue={address?.number ?? ""} error={fe.number} className="sm:col-span-2" />
      <TextField name="complement" label="Complemento" defaultValue={address?.complement ?? ""} className="sm:col-span-4" />
      <TextField name="neighborhood" label="Bairro" value={v.neighborhood} onChange={(e) => setV({ ...v, neighborhood: e.target.value })} error={fe.neighborhood} className="sm:col-span-3" />
      <TextField name="city" label="Cidade" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} error={fe.city} className="sm:col-span-2" />
      <div className="field sm:col-span-1">
        <label htmlFor="f-state">UF</label>
        <select id="f-state" name="state" className="select" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} aria-invalid={!!fe.state}>
          <option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
      <TextField name="reference" label="Referência (opcional)" defaultValue={address?.reference ?? ""} className="sm:col-span-6" />
      <label className="check text-sm sm:col-span-6"><input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} /><span>Usar como endereço principal</span></label>
      <div className="flex gap-3 sm:col-span-6">
        <Submit>Salvar endereço</Submit>
        {onDone && <button type="button" className="btn btn-ghost" onClick={onDone}>Cancelar</button>}
      </div>
    </form>
  );
}

export function AddressList({ addresses }: { addresses: Addr[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(addresses.length === 0);
  return (
    <div className="grid gap-4">
      {addresses.map((a) =>
        editing === a.id ? (
          <AddressForm key={a.id} address={a} onDone={() => setEditing(null)} />
        ) : (
          <div key={a.id} className="grid gap-1 border border-line bg-white p-5 text-[0.9375rem]">
            <p className="font-medium">{a.label ?? a.recipient}{a.isDefault && <span className="ml-2 text-sm font-normal text-graphite">principal</span>}</p>
            <p>{a.street}, {a.number}{a.complement ? `, ${a.complement}` : ""}</p>
            <p className="text-graphite">{a.neighborhood} · {a.city}/{a.state} · {maskCEP(a.cep)}</p>
            <div className="mt-3 flex gap-5 text-sm">
              <button type="button" className="underline underline-offset-4" onClick={() => setEditing(a.id)}>Editar</button>
              {removing === a.id ? (
                <>
                  <button type="button" className="text-wine underline underline-offset-4" onClick={() => deleteAddressAction(a.id)}>Confirmar remoção</button>
                  <button type="button" className="underline underline-offset-4" onClick={() => setRemoving(null)}>Cancelar</button>
                </>
              ) : (
                <button type="button" className="underline underline-offset-4" onClick={() => setRemoving(a.id)}>Remover</button>
              )}
            </div>
          </div>
        ),
      )}
      {adding ? <AddressForm onDone={addresses.length ? () => setAdding(false) : undefined} /> : <button type="button" className="btn btn-ghost w-fit" onClick={() => setAdding(true)}>Adicionar endereço</button>}
    </div>
  );
}
