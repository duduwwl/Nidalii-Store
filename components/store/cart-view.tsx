"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
import { maskCEP } from "@/lib/br";
import { applyCouponAction, cartDiscountAction, quoteShippingAction, removeCouponAction } from "@/app/actions/cart";
import type { QuoteOption } from "@/server/shipping";
import { useStore } from "./store-provider";
import { QuantityStepper } from "./quantity-stepper";

type Discount = { code: string | null; discountCents: number; error: string | null };

export function CartView({ shippingConfigured, pickupAvailable, initialDiscount }: { shippingConfigured: boolean; pickupAvailable: boolean; initialDiscount: Discount }) {
  const { cart, setCart, setQty, pending } = useStore();
  const [discount, setDiscount] = useState<Discount>(initialDiscount);
  const [code, setCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [cep, setCep] = useState("");
  const [quoteState, setQuote] = useState<{ options: QuoteOption[]; chosen: string; sig: string } | null>(null);
  const [shipErr, setShipErr] = useState<string | null>(null);
  const [shipBusy, setShipBusy] = useState(false);

  // A cotação vale para o carrinho em que foi feita; se o carrinho muda, ela deixa de valer
  const sig = `${cart.subtotalCents}:${cart.count}`;
  const quote = quoteState?.sig === sig ? quoteState : null;

  // Subtotal mudou: o desconto é recalculado no servidor
  useEffect(() => {
    let live = true;
    cartDiscountAction().then((d) => live && setDiscount(d));
    return () => { live = false; };
  }, [sig]);

  if (cart.lines.length === 0) {
    return (
      <div className="grid justify-items-start gap-6 py-10">
        <p className="text-lg text-graphite">Seu carrinho está vazio.</p>
        <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
      </div>
    );
  }

  const shipping = quote?.options.find((o) => o.id === quote.chosen)?.priceCents ?? null;
  const total = cart.subtotalCents - discount.discountCents + (shipping ?? 0);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponBusy(true);
    setCouponMsg(null);
    const r = await applyCouponAction(code);
    setCouponBusy(false);
    if (r.ok) {
      setCart(r.cart);
      setDiscount({ code: code.trim().toUpperCase(), discountCents: r.discountCents, error: null });
      setCode("");
    } else setCouponMsg(r.error);
  }

  async function calc(e: React.FormEvent) {
    e.preventDefault();
    setShipErr(null);
    if (cep.replace(/\D/g, "").length !== 8) { setShipErr("Digite os 8 números do CEP."); return; }
    setShipBusy(true);
    const r = await quoteShippingAction(cep);
    setShipBusy(false);
    if (r.ok) setQuote({ options: r.options, chosen: r.options[0]?.id ?? "", sig });
    else { setQuote(null); setShipErr(r.error); }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
      <section aria-label="Itens" className="lg:col-span-7">
        <ul className="divide-y divide-line border-y border-line" aria-busy={pending}>
          {cart.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[6.5rem_1fr] gap-4 py-6 sm:grid-cols-[8rem_1fr] sm:gap-6">
              <Link href={`/produtos/${l.slug}`} className="photo block" tabIndex={-1}>
                {l.image ? <Image src={l.image.url} alt={l.image.alt} fill sizes="128px" /> : <span className="photo-empty absolute inset-0">Sem foto</span>}
              </Link>
              <div className="grid content-start gap-1.5 min-w-0">
                <div className="flex justify-between gap-4">
                  <Link href={`/produtos/${l.slug}`} className="font-medium leading-snug">{l.name}</Link>
                  <span className="price shrink-0">{formatCents(l.totalCents)}</span>
                </div>
                <p className="text-sm text-graphite">{[l.colorName, l.size && `Tamanho ${l.size}`].filter(Boolean).join(" · ")}</p>
                {l.quantity > 1 && <p className="price text-sm text-graphite">{formatCents(l.unitCents)} cada</p>}
                {l.problem && <p className="error" role="alert">{l.problem}. Ajuste a quantidade ou remova.</p>}
                <div className="mt-3 flex items-center gap-5">
                  <QuantityStepper value={l.quantity} max={Math.max(1, Math.min(10, l.available))} onChange={(q) => setQty(l.id, q)} disabled={pending} label={`Quantidade de ${l.name}`} />
                  <button type="button" className="text-sm underline underline-offset-4" onClick={() => setQty(l.id, 0)} disabled={pending}>Remover</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/produtos" className="link mt-6 inline-block text-sm">Continuar comprando</Link>
      </section>

      <aside aria-label="Resumo" className="lg:col-span-4 lg:col-start-9">
        <div className="grid gap-6 bg-white p-6 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:p-8">
          <h2 className="font-display text-[1.75rem]">Resumo</h2>

          <form onSubmit={applyCoupon} className="grid gap-2">
            <label htmlFor="cupom" className="label">Cupom</label>
            {discount.code && !discount.error ? (
              <div className="flex items-center justify-between gap-3 border border-line px-3 py-2.5 text-sm">
                <span><span className="font-medium">{discount.code}</span> aplicado</span>
                <button type="button" className="underline underline-offset-4" onClick={async () => { setCart(await removeCouponAction()); setDiscount({ code: null, discountCents: 0, error: null }); }}>Remover</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input id="cupom" className="input uppercase" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" aria-invalid={!!couponMsg} aria-describedby={couponMsg ? "cupom-erro" : undefined} />
                <button className="btn btn-ghost shrink-0" disabled={couponBusy || !code.trim()}>{couponBusy ? "…" : "Aplicar"}</button>
              </div>
            )}
            {(couponMsg || discount.error) && <p id="cupom-erro" className="error" role="alert">{couponMsg ?? discount.error}</p>}
          </form>

          {shippingConfigured ? (
            <form onSubmit={calc} className="grid gap-2">
              <label htmlFor="cep-carrinho" className="label">Frete</label>
              <div className="flex gap-2">
                <input id="cep-carrinho" className="input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} aria-invalid={!!shipErr} />
                <button className="btn btn-ghost shrink-0" disabled={shipBusy}>{shipBusy ? "…" : "Calcular"}</button>
              </div>
              {shipErr && <p className="error" role="alert">{shipErr}</p>}
              {quote && (
                <fieldset className="mt-1 grid gap-2">
                  <legend className="sr-only">Opções de frete</legend>
                  {quote.options.map((o) => (
                    <label key={o.id} className="check justify-between text-sm">
                      <span className="flex gap-2.5">
                        <input type="radio" name="frete" checked={quote.chosen === o.id} onChange={() => setQuote({ ...quote, chosen: o.id })} />
                        <span>{o.serviceName}{o.carrier ? ` · ${o.carrier}` : ""}<span className="block text-graphite">{o.daysMin === o.daysMax ? o.daysMax : `${o.daysMin} a ${o.daysMax}`} dias úteis</span></span>
                      </span>
                      <span className="price">{o.priceCents === 0 ? "Grátis" : formatCents(o.priceCents)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {pickupAvailable && <p className="hint">Ou retire na loja sem frete. Você escolhe no checkout.</p>}
            </form>
          ) : (
            <p className="hint">O frete é calculado no checkout, pelo CEP de entrega.{pickupAvailable ? " Você também pode retirar na loja." : ""}</p>
          )}

          <dl className="grid gap-2 border-t border-line pt-5 text-[0.9375rem]">
            <Row label="Subtotal" value={formatCents(cart.subtotalCents)} />
            {discount.discountCents > 0 && <Row label="Desconto" value={`− ${formatCents(discount.discountCents)}`} />}
            <Row label="Frete" value={shipping == null ? "A calcular" : shipping === 0 ? "Grátis" : formatCents(shipping)} muted={shipping == null} />
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4">
              <dt className="font-medium">Total{shipping == null ? " estimado" : ""}</dt>
              <dd className="price text-xl">{formatCents(total)}</dd>
            </div>
          </dl>

          {cart.hasProblems ? (
            <p className="error" role="alert">Ajuste os itens destacados para finalizar.</p>
          ) : (
            <Link href="/checkout" className="btn btn-solid btn-block">Finalizar compra</Link>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-graphite">{label}</dt>
      <dd className={`price ${muted ? "text-graphite" : ""}`}>{value}</dd>
    </div>
  );
}
