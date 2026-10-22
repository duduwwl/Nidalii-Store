"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { isValidCEP, isValidCPF, isValidPhoneBR, maskCEP, maskCPF, maskPhone, UFS } from "@/lib/br";
import { lookupCepAction, quoteShippingAction } from "@/app/actions/cart";
import { createOrderAction } from "@/app/actions/checkout";
import type { QuoteOption } from "@/server/shipping";
import { IconStore, IconTruck } from "../icons";
import { useStore } from "./store-provider";

type Line = { id: string; name: string; colorName: string | null; size: string | null; quantity: number; totalCents: number; image: { url: string; alt: string } | null; problem: string | null };
type Address = { id: string; label: string | null; cep: string; street: string; number: string; complement: string | null; neighborhood: string; city: string; state: string; reference: string | null };
type Hours = { days: string; open: string; close: string };

type Form = {
  fullName: string; email: string; cpf: string; phone: string;
  fulfillment: "DELIVERY" | "PICKUP";
  cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string; reference: string;
  shippingQuoteId: string; note: string; acceptTerms: boolean;
};

export function CheckoutForm(props: {
  lines: Line[]; subtotalCents: number; discount: { code: string | null; discountCents: number; error: string | null }; hasProblems: boolean;
  customer: { fullName: string; email: string; cpf: string; phone: string } | null;
  addresses: Address[]; shippingConfigured: boolean;
  pickup: { address: string; hours: Hours[]; instructions: string | null } | null;
}) {
  const router = useRouter();
  const { setCart } = useStore();
  // Uma chave por tentativa de checkout: reenviar o formulário nunca cria pedido duplicado
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const first = props.addresses[0];
  const [f, setF] = useState<Form>({
    fullName: props.customer?.fullName ?? "", email: props.customer?.email ?? "",
    cpf: props.customer?.cpf ? maskCPF(props.customer.cpf) : "", phone: props.customer?.phone ? maskPhone(props.customer.phone) : "",
    fulfillment: props.shippingConfigured || !props.pickup ? "DELIVERY" : "PICKUP",
    cep: first ? maskCEP(first.cep) : "", street: first?.street ?? "", number: first?.number ?? "", complement: first?.complement ?? "",
    neighborhood: first?.neighborhood ?? "", city: first?.city ?? "", state: first?.state ?? "", reference: first?.reference ?? "",
    shippingQuoteId: "", note: "", acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(props.customer?.cpf && props.customer.phone ? 2 : 1);
  const [options, setOptions] = useState<QuoteOption[] | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [cepBusy, setCepBusy] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const shipping = f.fulfillment === "PICKUP" ? 0 : options?.find((o) => o.id === f.shippingQuoteId)?.priceCents ?? null;
  const total = props.subtotalCents - props.discount.discountCents + (shipping ?? 0);

  // CEP completo: busca o endereço e cota o frete
  const lastCep = useRef("");
  useEffect(() => {
    const digits = f.cep.replace(/\D/g, "");
    if (f.fulfillment !== "DELIVERY" || digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    (async () => {
      setCepBusy(true);
      const r = await lookupCepAction(digits);
      setCepBusy(false);
      if (r.ok) {
        setF((p) => ({
          ...p,
          street: r.address.street || p.street, neighborhood: r.address.neighborhood || p.neighborhood,
          city: r.address.city || p.city, state: r.address.state || p.state,
        }));
      } else setErrors((e) => ({ ...e, cep: r.error }));
      if (props.shippingConfigured) {
        setQuoteBusy(true); setQuoteErr(null); setOptions(null);
        const q = await quoteShippingAction(digits);
        setQuoteBusy(false);
        if (q.ok) { setOptions(q.options); setF((p) => ({ ...p, shippingQuoteId: q.options[0]?.id ?? "" })); }
        else setQuoteErr(q.error);
      }
    })();
  }, [f.cep, f.fulfillment, props.shippingConfigured]);

  function validateStep1() {
    const e: Record<string, string> = {};
    if (f.fullName.trim().split(/\s+/).length < 2) e.fullName = "Informe nome e sobrenome.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Confira o e-mail.";
    if (!isValidCPF(f.cpf)) e.cpf = "CPF inválido. Confira os números.";
    if (!isValidPhoneBR(f.phone)) e.phone = "Telefone com DDD.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function validateStep2() {
    const e: Record<string, string> = {};
    if (f.fulfillment === "DELIVERY") {
      if (!isValidCEP(f.cep)) e.cep = "CEP inválido.";
      if (!f.street.trim()) e.street = "Informe a rua.";
      if (!f.number.trim()) e.number = "Informe o número (ou s/n).";
      if (!f.neighborhood.trim()) e.neighborhood = "Informe o bairro.";
      if (!f.city.trim()) e.city = "Informe a cidade.";
      if (!f.state) e.state = "Escolha o estado.";
      if (!f.shippingQuoteId) e.shippingQuoteId = props.shippingConfigured ? "Escolha uma opção de frete." : "A entrega ainda não está disponível. Escolha retirar na loja.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const focusFirstError = () => setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 30);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep1()) { setStep(1); focusFirstError(); return; }
    if (!validateStep2()) { setStep(2); focusFirstError(); return; }
    if (!f.acceptTerms) { setErrors({ acceptTerms: "Aceite os termos para continuar." }); return; }
    setSubmitting(true);
    setFormError(null);
    const r = await createOrderAction({ ...f, idempotencyKey });
    if (r.ok) {
      setCart({ count: 0, subtotalCents: 0, couponCode: null, hasProblems: false, lines: [] });
      router.push(r.payUrl);
      return;
    }
    setSubmitting(false);
    setFormError(r.error);
    if (r.fieldErrors) {
      setErrors(r.fieldErrors);
      const s1 = ["fullName", "email", "cpf", "phone"].some((k) => r.fieldErrors![k]);
      setStep(s1 ? 1 : 2);
      focusFirstError();
    }
  }

  const deliveryLabel = useMemo(() => {
    if (f.fulfillment === "PICKUP") return "Retirada na loja";
    const o = options?.find((x) => x.id === f.shippingQuoteId);
    return o ? `${o.serviceName} · ${o.daysMin === o.daysMax ? o.daysMax : `${o.daysMin} a ${o.daysMax}`} dias úteis` : null;
  }, [f.fulfillment, f.shippingQuoteId, options]);

  return (
    <form onSubmit={submit} noValidate className="grid gap-12 lg:grid-cols-12 lg:gap-6">
      <div className="grid content-start gap-4 lg:col-span-7">
        {/* No celular, o total fica visível no topo; os itens abrem num toque */}
        <details className="bg-white lg:hidden">
          <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
            <span className="text-sm">Resumo · {props.lines.reduce((n, l) => n + l.quantity, 0)} {props.lines.length === 1 && props.lines[0].quantity === 1 ? "item" : "itens"}</span>
            <span className="price font-medium">{formatCents(total)}</span>
          </summary>
          <ul className="grid gap-2 border-t border-line p-4 text-sm">
            {props.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-4"><span>{l.name}<span className="block text-graphite">{[l.colorName, l.size, `${l.quantity} un.`].filter(Boolean).join(" · ")}</span></span><span className="price">{formatCents(l.totalCents)}</span></li>
            ))}
          </ul>
        </details>
        {formError && <p className="border border-wine bg-white p-4 text-wine" role="alert">{formError}</p>}

        {/* Etapa 1: identificação */}
        <Step n={1} title="Seus dados" current={step} onEdit={() => setStep(1)}
          summary={`${f.fullName} · ${f.email}`}>
          {!props.customer && (
            <p className="text-sm text-graphite">Já tem conta? <Link href="/entrar?voltar=/checkout" className="link">Entre</Link> para usar seus endereços. Ou continue sem cadastro.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="fullName" label="Nome completo" error={errors.fullName} className="sm:col-span-2">
              <input id="fullName" className="input" autoComplete="name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} aria-invalid={!!errors.fullName} />
            </Field>
            <Field id="email" label="E-mail" error={errors.email} hint="Enviamos a confirmação do pedido para ele.">
              <input id="email" type="email" className="input" autoComplete="email" inputMode="email" spellCheck={false} value={f.email} readOnly={!!props.customer} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
            </Field>
            <Field id="phone" label="Celular com DDD" error={errors.phone}>
              <input id="phone" type="tel" className="input" autoComplete="tel-national" inputMode="tel" placeholder="(00) 00000-0000" value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} aria-invalid={!!errors.phone} />
            </Field>
            <Field id="cpf" label="CPF" error={errors.cpf} hint="Exigido para emitir a nota e para o envio.">
              <input id="cpf" className="input" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" spellCheck={false} value={f.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} aria-invalid={!!errors.cpf} />
            </Field>
          </div>
          <button type="button" className="btn btn-solid w-full sm:w-fit" onClick={() => { if (validateStep1()) setStep(2); else focusFirstError(); }}>Continuar para entrega</button>
        </Step>

        {/* Etapa 2: entrega ou retirada */}
        <Step n={2} title="Entrega" current={step} onEdit={() => setStep(2)} summary={deliveryLabel ?? ""}>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Como você quer receber</legend>
            <Choice checked={f.fulfillment === "DELIVERY"} onChange={() => { set("fulfillment", "DELIVERY"); if (options?.[0]) set("shippingQuoteId", options[0].id); }} icon={<IconTruck size={22} />} title="Receber em casa" text="Entrega para todo o Brasil" />
            {props.pickup && (
              <Choice checked={f.fulfillment === "PICKUP"} onChange={() => { set("fulfillment", "PICKUP"); set("shippingQuoteId", ""); }} icon={<IconStore size={22} />} title="Retirar na loja" text="Sem frete" />
            )}
          </fieldset>

          {f.fulfillment === "DELIVERY" ? (
            <div className="grid gap-4">
              {props.addresses.length > 1 && (
                <div className="field">
                  <label htmlFor="saved">Endereços salvos</label>
                  <select id="saved" className="select" onChange={(e) => {
                    const a = props.addresses.find((x) => x.id === e.target.value);
                    if (a) { lastCep.current = ""; setF((p) => ({ ...p, cep: maskCEP(a.cep), street: a.street, number: a.number, complement: a.complement ?? "", neighborhood: a.neighborhood, city: a.city, state: a.state, reference: a.reference ?? "", shippingQuoteId: "" })); }
                  }}>
                    {props.addresses.map((a) => <option key={a.id} value={a.id}>{a.label ? `${a.label}: ` : ""}{a.street}, {a.number} — {a.city}/{a.state}</option>)}
                  </select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-6">
                <Field id="cep" label="CEP" error={errors.cep} className="sm:col-span-2" hint={cepBusy ? "Buscando endereço…" : undefined}>
                  <input id="cep" className="input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={f.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} aria-invalid={!!errors.cep} />
                </Field>
                <div className="hidden sm:col-span-4 sm:flex sm:items-end sm:pb-3"><a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noopener" className="text-sm text-graphite underline underline-offset-4">Não sei meu CEP</a></div>
                <Field id="street" label="Rua" error={errors.street} className="sm:col-span-4">
                  <input id="street" className="input" autoComplete="address-line1" value={f.street} onChange={(e) => set("street", e.target.value)} aria-invalid={!!errors.street} />
                </Field>
                <Field id="number" label="Número" error={errors.number} className="sm:col-span-2">
                  <input id="number" className="input" inputMode="numeric" value={f.number} onChange={(e) => set("number", e.target.value)} aria-invalid={!!errors.number} />
                </Field>
                <Field id="complement" label="Complemento (opcional)" className="sm:col-span-3">
                  <input id="complement" className="input" autoComplete="address-line2" value={f.complement} onChange={(e) => set("complement", e.target.value)} />
                </Field>
                <Field id="neighborhood" label="Bairro" error={errors.neighborhood} className="sm:col-span-3">
                  <input id="neighborhood" className="input" value={f.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} aria-invalid={!!errors.neighborhood} />
                </Field>
                <Field id="city" label="Cidade" error={errors.city} className="sm:col-span-4">
                  <input id="city" className="input" autoComplete="address-level2" value={f.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} />
                </Field>
                <Field id="state" label="Estado" error={errors.state} className="sm:col-span-2">
                  <select id="state" className="select" autoComplete="address-level1" value={f.state} onChange={(e) => set("state", e.target.value)} aria-invalid={!!errors.state}>
                    <option value="">UF</option>
                    {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field id="reference" label="Ponto de referência (opcional)" className="sm:col-span-6">
                  <input id="reference" className="input" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
                </Field>
              </div>

              <fieldset className="grid gap-2" aria-describedby={errors.shippingQuoteId ? "frete-erro" : undefined}>
                <legend className="label mb-2">Frete</legend>
                {!props.shippingConfigured && <p className="hint">A entrega ainda não foi configurada pela loja.{props.pickup ? " Escolha retirar na loja." : ""}</p>}
                {quoteBusy && <p className="hint">Calculando frete…</p>}
                {quoteErr && <p className="error" role="alert">{quoteErr}</p>}
                {!quoteBusy && props.shippingConfigured && !options && !quoteErr && <p className="hint">Digite o CEP para ver as opções.</p>}
                {options?.map((o) => (
                  <label key={o.id} className={`check justify-between border p-4 ${f.shippingQuoteId === o.id ? "border-ink" : "border-line"} bg-white`}>
                    <span className="flex gap-3">
                      <input type="radio" name="shippingQuoteId" checked={f.shippingQuoteId === o.id} onChange={() => set("shippingQuoteId", o.id)} />
                      <span>{o.serviceName}{o.carrier ? ` · ${o.carrier}` : ""}<span className="block text-sm text-graphite">{o.daysMin === o.daysMax ? o.daysMax : `${o.daysMin} a ${o.daysMax}`} dias úteis após a confirmação do pagamento</span></span>
                    </span>
                    <span className="price">{o.priceCents === 0 ? "Grátis" : formatCents(o.priceCents)}</span>
                  </label>
                ))}
                {errors.shippingQuoteId && <p id="frete-erro" className="error" role="alert">{errors.shippingQuoteId}</p>}
              </fieldset>
            </div>
          ) : props.pickup ? (
            <div className="grid gap-2 bg-white p-5 text-[0.9375rem]">
              <p className="font-medium">{props.pickup.address}</p>
              {props.pickup.hours.map((h) => <p key={h.days} className="text-graphite">{h.days}: {h.open} às {h.close}</p>)}
              <p className="mt-2 text-sm text-graphite">{props.pickup.instructions ?? "Avisamos por e-mail quando o pedido estiver separado. Leve um documento com foto."}</p>
            </div>
          ) : null}

          <Field id="note" label="Observação para a loja (opcional)">
            <textarea id="note" className="textarea !min-h-20" maxLength={500} value={f.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          <button type="button" className="btn btn-solid w-full sm:w-fit" onClick={() => { if (validateStep2()) setStep(3); else focusFirstError(); }}>Revisar pedido</button>
        </Step>

        {/* Etapa 3: revisão e confirmação */}
        <Step n={3} title="Revisão" current={step} onEdit={() => setStep(3)} summary="">
          <dl className="grid gap-3 text-[0.9375rem]">
            <div><dt className="text-sm text-graphite">Dados</dt><dd>{f.fullName} · {f.email} · {f.phone}</dd></div>
            <div><dt className="text-sm text-graphite">{f.fulfillment === "PICKUP" ? "Retirada" : "Entrega"}</dt>
              <dd>{f.fulfillment === "PICKUP" ? props.pickup?.address : `${f.street}, ${f.number}${f.complement ? `, ${f.complement}` : ""} — ${f.neighborhood}, ${f.city}/${f.state} · ${f.cep}`}</dd>
              {deliveryLabel && f.fulfillment === "DELIVERY" && <dd className="text-sm text-graphite">{deliveryLabel}</dd>}
            </div>
          </dl>
          <label className="check text-sm">
            <input type="checkbox" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} aria-invalid={!!errors.acceptTerms} />
            <span>Li e aceito os <Link href="/termos-de-uso" target="_blank" className="link">termos de uso</Link>, a <Link href="/politica-de-privacidade" target="_blank" className="link">política de privacidade</Link> e a <Link href="/trocas-e-devolucoes" target="_blank" className="link">política de trocas</Link>.</span>
          </label>
          {errors.acceptTerms && <p className="error" role="alert">{errors.acceptTerms}</p>}
          <button className="btn btn-solid btn-block sm:w-fit" disabled={submitting || props.hasProblems}>
            {submitting ? "Criando pedido…" : `Ir para o pagamento · ${formatCents(total)}`}
          </button>
          <p className="hint">Na próxima tela você escolhe Pix, crédito ou débito. As peças ficam reservadas enquanto você paga.</p>
        </Step>
      </div>

      <aside aria-label="Resumo do pedido" className="lg:col-span-4 lg:col-start-9">
        <div className="grid gap-5 bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:p-8">
          <h2 className="font-display text-[1.75rem]">Seu pedido</h2>
          <ul className="grid gap-4">
            {props.lines.map((l) => (
              <li key={l.id} className="grid grid-cols-[3.5rem_1fr_auto] items-start gap-3 text-sm">
                <span className="photo block">{l.image ? <Image src={l.image.url} alt="" fill sizes="56px" /> : null}</span>
                <span className="grid gap-0.5"><span className="font-medium leading-snug">{l.name}</span><span className="text-graphite">{[l.colorName, l.size, `${l.quantity} un.`].filter(Boolean).join(" · ")}</span>{l.problem && <span className="error">{l.problem}</span>}</span>
                <span className="price">{formatCents(l.totalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-2 border-t border-line pt-4 text-[0.9375rem]">
            <div className="flex justify-between"><dt className="text-graphite">Subtotal</dt><dd className="price">{formatCents(props.subtotalCents)}</dd></div>
            {props.discount.discountCents > 0 && <div className="flex justify-between"><dt className="text-graphite">Cupom {props.discount.code}</dt><dd className="price">− {formatCents(props.discount.discountCents)}</dd></div>}
            <div className="flex justify-between"><dt className="text-graphite">{f.fulfillment === "PICKUP" ? "Retirada na loja" : "Frete"}</dt><dd className="price">{f.fulfillment === "PICKUP" ? "Sem custo" : shipping == null ? "A calcular" : shipping === 0 ? "Grátis" : formatCents(shipping)}</dd></div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4"><dt className="font-medium">Total</dt><dd className="price text-xl">{formatCents(total)}</dd></div>
          </dl>
          {props.discount.error && <p className="error">{props.discount.error}</p>}
          <Link href="/carrinho" className="text-sm underline underline-offset-4">Alterar carrinho</Link>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, current, summary, onEdit, children }: { n: 1 | 2 | 3; title: string; current: number; summary: string; onEdit: () => void; children: React.ReactNode }) {
  const open = current === n;
  const done = current > n;
  return (
    <section aria-labelledby={`step-${n}`} className={`border-t border-line pt-6 ${open ? "pb-4" : "pb-2"}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`step-${n}`} className={`font-display text-[1.625rem] ${!open && !done ? "text-graphite/70" : ""}`}>
          <span className="price mr-3 text-base">{n}</span>{title}
        </h2>
        {done && <button type="button" onClick={onEdit} className="text-sm underline underline-offset-4">Alterar</button>}
      </div>
      {done && summary && <p className="mt-2 text-sm text-graphite">{summary}</p>}
      {open && <div className="mt-6 grid gap-6" style={{ animation: "nd-step 260ms var(--ease-soft)" }}>{children}</div>}
      <style>{`@keyframes nd-step { from { opacity: 0; transform: translateY(6px); } }`}</style>
    </section>
  );
}

function Field({ id, label, error, hint, className = "", children }: { id: string; label: string; error?: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="error" id={`${id}-erro`} role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function Choice({ checked, onChange, icon, title, text }: { checked: boolean; onChange: () => void; icon: React.ReactNode; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer items-center gap-4 border bg-white p-4 transition-colors ${checked ? "border-ink" : "border-line"}`}>
      <input type="radio" name="fulfillment" checked={checked} onChange={onChange} className="size-4 accent-ink" />
      {icon}
      <span className="grid"><span className="font-medium">{title}</span><span className="text-sm text-graphite">{text}</span></span>
    </label>
  );
}
