"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  createStaffAction, removeStaffAction, savePaymentSettingsAction, saveShippingAction, saveStoreInfoAction, saveTextsAction,
} from "@/app/admin/actions/store";
import { centsToInput } from "@/lib/money";
import { maskCEP, maskPhone, UFS } from "@/lib/br";
import { FormMessage, Submit, TextField } from "../ui/form";

const box = "grid gap-5 bg-white p-5 lg:p-6";

type Ship = {
  originCep: string; defaultWeightGrams: number | null; defaultLengthCm: number | null; defaultWidthCm: number | null; defaultHeightCm: number | null;
  enabledShippingServices: string[]; freeShippingMinCents: number | null; pickupEnabled: boolean;
  storeStreet: string; storeNumber: string; storeComplement: string; storeNeighborhood: string; storeCity: string; storeState: string; storeCep: string;
  hours: { days: string; open: string; close: string }[]; pickupInstructions: string;
};

export function ShippingForm({ s, services, tokenConfigured, env }: { s: Ship; services: { id: string; name: string; company: string }[] | null; tokenConfigured: boolean; env: string }) {
  const [state, action] = useActionState(saveShippingAction, null);
  const fe = state?.fieldErrors ?? {};
  const hours = [...s.hours, ...Array(Math.max(0, 3 - s.hours.length)).fill({ days: "", open: "", close: "" })].slice(0, 7);
  return (
    <form action={action} className="grid max-w-4xl gap-6">
      <FormMessage state={state} />
      <section className={box}>
        <div>
          <h2 className="text-lg font-medium">Melhor Envio</h2>
          <p className={`mt-1 text-sm ${tokenConfigured ? "text-ok" : "text-wine"}`}>
            {tokenConfigured ? `Token configurado · ambiente: ${env}` : "Token não configurado. Defina MELHOR_ENVIO_TOKEN no servidor (veja DEPLOY.md)."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="originCep" label="CEP de onde saem os envios" defaultValue={s.originCep ? maskCEP(s.originCep) : ""} inputMode="numeric" error={fe.originCep} />
          <TextField name="freeShippingMin" label="Frete grátis a partir de (R$)" inputMode="decimal" defaultValue={centsToInput(s.freeShippingMinCents)} hint="Vale para a opção mais barata. Vazio: sem frete grátis." className="sm:col-span-2" />
        </div>
        <fieldset className="grid gap-2">
          <legend className="label mb-2">Serviços oferecidos</legend>
          {services ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {services.map((x) => (
                <label key={x.id} className="check text-sm"><input type="checkbox" name="services" value={x.id} defaultChecked={s.enabledShippingServices.includes(x.id)} /><span>{x.company} {x.name}</span></label>
              ))}
            </div>
          ) : (
            <>
              <p className="hint">{tokenConfigured ? "Não foi possível carregar a lista de serviços do Melhor Envio agora." : "A lista de serviços aparece aqui quando o token estiver configurado."}</p>
              {s.enabledShippingServices.map((id) => <input key={id} type="hidden" name="services" value={id} />)}
            </>
          )}
        </fieldset>
        <div>
          <p className="label">Embalagem padrão</p>
          <p className="hint mb-3">Usada quando a peça não tem peso e medidas próprios.</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <TextField name="defaultWeightGrams" label="Peso (g)" inputMode="numeric" defaultValue={s.defaultWeightGrams ?? ""} />
            <TextField name="defaultLengthCm" label="Comprimento (cm)" inputMode="numeric" defaultValue={s.defaultLengthCm ?? ""} />
            <TextField name="defaultWidthCm" label="Largura (cm)" inputMode="numeric" defaultValue={s.defaultWidthCm ?? ""} />
            <TextField name="defaultHeightCm" label="Altura (cm)" inputMode="numeric" defaultValue={s.defaultHeightCm ?? ""} />
          </div>
        </div>
      </section>

      <section className={box}>
        <h2 className="text-lg font-medium">Loja física e retirada</h2>
        <div className="grid gap-4 sm:grid-cols-6">
          <TextField name="storeCep" label="CEP" defaultValue={s.storeCep ? maskCEP(s.storeCep) : ""} inputMode="numeric" className="sm:col-span-2" />
          <TextField name="storeStreet" label="Rua" defaultValue={s.storeStreet} className="sm:col-span-4" />
          <TextField name="storeNumber" label="Número" defaultValue={s.storeNumber} className="sm:col-span-2" />
          <TextField name="storeComplement" label="Complemento" defaultValue={s.storeComplement} className="sm:col-span-4" />
          <TextField name="storeNeighborhood" label="Bairro" defaultValue={s.storeNeighborhood} className="sm:col-span-3" />
          <TextField name="storeCity" label="Cidade" defaultValue={s.storeCity} className="sm:col-span-2" />
          <div className="field sm:col-span-1">
            <label htmlFor="storeState">UF</label>
            <select id="storeState" name="storeState" className="select" defaultValue={s.storeState} aria-invalid={!!fe.storeState}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
        </div>
        <fieldset className="grid gap-3">
          <legend className="label mb-2">Horário de atendimento</legend>
          {fe.hours && <p className="error">{fe.hours}</p>}
          {hours.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_6rem] gap-2">
              <input aria-label={`Dias, linha ${i + 1}`} name={`h${i}days`} className="input" defaultValue={h.days} placeholder="Segunda a sexta" />
              <input aria-label={`Abre, linha ${i + 1}`} name={`h${i}open`} type="time" className="input" defaultValue={h.open} />
              <input aria-label={`Fecha, linha ${i + 1}`} name={`h${i}close`} type="time" className="input" defaultValue={h.close} />
            </div>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="pickupInstructions">Instruções de retirada</label>
          <textarea id="pickupInstructions" name="pickupInstructions" className="textarea !min-h-20" defaultValue={s.pickupInstructions} maxLength={400} placeholder="Ex.: Retire em até 7 dias com documento com foto." />
        </div>
        <label className="check"><input type="checkbox" name="pickupEnabled" defaultChecked={s.pickupEnabled} /><span>Oferecer retirada na loja no checkout</span></label>
        {fe.pickupEnabled && <p className="error">{fe.pickupEnabled}</p>}
      </section>
      <div><Submit>Salvar frete e retirada</Submit></div>
    </form>
  );
}

export function StoreInfoForm({ s }: { s: { legalName: string; cnpj: string; whatsapp: string; contactEmail: string; instagramUrl: string; announcementText: string; logoUrl: string | null } }) {
  const [state, action] = useActionState(saveStoreInfoAction, null);
  const fe = state?.fieldErrors ?? {};
  const [wa, setWa] = useState(s.whatsapp ? maskPhone(s.whatsapp) : "");
  return (
    <form action={action} className={box}>
      <h2 className="text-lg font-medium">Dados da loja</h2>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="legalName" label="Razão social" defaultValue={s.legalName} />
        <TextField name="cnpj" label="CNPJ" defaultValue={s.cnpj} inputMode="numeric" error={fe.cnpj} />
        <TextField name="whatsapp" label="WhatsApp de atendimento" value={wa} onChange={(e) => setWa(maskPhone(e.target.value))} inputMode="tel" error={fe.whatsapp} />
        <TextField name="contactEmail" label="E-mail de atendimento" type="email" defaultValue={s.contactEmail} error={fe.contactEmail} />
        <TextField name="instagramUrl" label="Instagram" defaultValue={s.instagramUrl} error={fe.instagramUrl} className="sm:col-span-2" />
        <TextField name="announcementText" label="Faixa acima do menu" defaultValue={s.announcementText} maxLength={120} hint="Ex.: aviso de frete ou troca. Vazio: a faixa não aparece." className="sm:col-span-2" />
        <div className="field sm:col-span-2">
          <label htmlFor="logo">Logo</label>
          {s.logoUrl && <span className="relative mb-2 block size-16"><Image src={s.logoUrl} alt="Logo atual" fill sizes="64px" className="object-contain" /></span>}
          <input id="logo" name="logo" type="file" accept="image/png,image/webp,image/jpeg" className="text-sm" />
          <p className="hint">PNG com fundo transparente. Sem logo, o site usa a assinatura tipográfica.</p>
          {s.logoUrl && <label className="check mt-1 text-sm"><input type="checkbox" name="removeLogo" /><span>Remover logo</span></label>}
        </div>
      </div>
      <div><Submit>Salvar dados</Submit></div>
    </form>
  );
}

export function PaymentForm({ s, status }: { s: { maxInstallments: number; installmentsWithoutInterest: number; pixExpirationMinutes: number }; status: { mp: boolean; webhook: boolean; env: string } }) {
  const [state, action] = useActionState(savePaymentSettingsAction, null);
  return (
    <form action={action} className={box}>
      <h2 className="text-lg font-medium">Pagamento</h2>
      <ul className="grid gap-1 text-sm">
        <li className={status.mp ? "text-ok" : "text-wine"}>{status.mp ? `Mercado Pago conectado (${status.env})` : "Mercado Pago não configurado (MP_ACCESS_TOKEN e NEXT_PUBLIC_MP_PUBLIC_KEY)"}</li>
        <li className={status.webhook ? "text-ok" : "text-wine"}>{status.webhook ? "Assinatura do webhook configurada" : "Webhook sem assinatura (MP_WEBHOOK_SECRET). Sem ela, os pagamentos não são confirmados automaticamente."}</li>
      </ul>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField name="maxInstallments" label="Parcelas no crédito (máx.)" type="number" min={1} max={12} defaultValue={s.maxInstallments} />
        <TextField name="installmentsWithoutInterest" label="Parcelas sem juros" type="number" min={1} max={12} defaultValue={s.installmentsWithoutInterest} hint="Precisa bater com a configuração da sua conta no Mercado Pago." />
        <TextField name="pixExpirationMinutes" label="Validade do Pix (min)" type="number" min={10} max={1440} defaultValue={s.pixExpirationMinutes} />
      </div>
      <div><Submit>Salvar pagamento</Submit></div>
    </form>
  );
}

const TEXTS: { key: string; label: string; hint: string }[] = [
  { key: "aboutText", label: "Sobre a loja", hint: "Página /sobre." },
  { key: "sizeGuide", label: "Guia de medidas", hint: "Aparece na página de cada produto. Para tabela use: | Tamanho | Busto | Cintura |" },
  { key: "shippingPolicy", label: "Entregas e retirada", hint: "Página /entregas." },
  { key: "returnsPolicy", label: "Trocas e devoluções", hint: "Página /trocas-e-devolucoes." },
  { key: "privacyPolicy", label: "Política de privacidade", hint: "Página /politica-de-privacidade." },
  { key: "termsOfUse", label: "Termos de uso", hint: "Página /termos-de-uso." },
];

export function TextsForm({ values, defaults }: { values: Record<string, string>; defaults: Record<string, string> }) {
  const [state, action] = useActionState(saveTextsAction, null);
  return (
    <form action={action} className={box}>
      <div>
        <h2 className="text-lg font-medium">Textos da loja</h2>
        <p className="hint mt-1">Use ## para títulos, - para listas e **negrito**. Campos vazios mostram o texto padrão do sistema, que descreve só o que o site faz e o que a lei garante. Revise antes de publicar.</p>
      </div>
      <FormMessage state={state} />
      {TEXTS.map((t) => (
        <details key={t.key} className="border border-line p-4">
          <summary className="cursor-pointer font-medium">{t.label}{values[t.key] ? "" : <span className="ml-2 text-sm font-normal text-wine">usando texto padrão</span>}</summary>
          <div className="field mt-3">
            <label htmlFor={`tx-${t.key}`} className="sr-only">{t.label}</label>
            <textarea id={`tx-${t.key}`} name={t.key} className="textarea !min-h-60 text-sm" defaultValue={values[t.key] ?? ""} placeholder={defaults[t.key] ?? ""} />
            <p className="hint">{t.hint}</p>
          </div>
        </details>
      ))}
      <div><Submit>Salvar textos</Submit></div>
    </form>
  );
}

export function StaffManager({ staff, me }: { staff: { id: string; email: string; role: string; name: string }[]; me: string }) {
  const [state, action] = useActionState(createStaffAction, null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string } | null>(null);
  const fe = state?.fieldErrors ?? {};
  return (
    <section className={box}>
      <h2 className="text-lg font-medium">Equipe com acesso ao painel</h2>
      {msg && <FormMessage state={msg} />}
      <ul className="grid gap-2 text-sm">
        {staff.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
            <span><span className="font-medium">{u.name}</span> · {u.email} · {u.role === "ADMIN" ? "Administradora" : "Atendimento"}</span>
            {u.id !== me && <button type="button" className="text-wine underline underline-offset-4" disabled={pending} onClick={() => start(async () => setMsg(await removeStaffAction(u.id)))}>Remover</button>}
          </li>
        ))}
      </ul>
      <details className="border border-dashed border-line p-4">
        <summary className="cursor-pointer font-medium">Dar acesso a alguém</summary>
        <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><FormMessage state={state && !state.fieldErrors ? state : null} /></div>
          <TextField name="displayName" label="Nome" error={fe.displayName} />
          <TextField name="email" type="email" label="E-mail" error={fe.email} autoComplete="off" />
          <TextField name="password" type="password" label="Senha inicial" error={fe.password} autoComplete="new-password" hint="Mínimo de 12 caracteres. Combine a troca com a pessoa." />
          <div className="field">
            <label htmlFor="role">Permissão</label>
            <select id="role" name="role" className="select"><option value="STAFF">Atendimento (pedidos, produtos, estoque)</option><option value="ADMIN">Administradora (tudo)</option></select>
          </div>
          <div className="sm:col-span-2"><Submit className="btn btn-solid btn-sm">Criar acesso</Submit></div>
        </form>
      </details>
    </section>
  );
}
