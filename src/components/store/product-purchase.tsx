"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import { maskCEP } from "@/lib/br";
import { quoteProductShippingAction } from "@/app/actions/cart";
import type { QuoteOption } from "@/server/shipping";
import { Drawer } from "../ui/drawer";
import { IconHeart, IconRuler, IconShare, IconStore, IconTruck } from "../icons";
import { useStore } from "./store-provider";
import { ProductGallery, type GalleryImage } from "./product-gallery";

export type PurchaseVariant = { id: string; colorName: string | null; colorHex: string | null; size: string | null; available: number; priceCents: number };
export type PurchaseImage = GalleryImage & { colorName: string | null };

export function ProductPurchase(props: {
  productId: string;
  name: string;
  category: { name: string; slug: string } | null;
  priceCents: number;
  compareAtCents: number | null;
  variants: PurchaseVariant[];
  images: PurchaseImage[];
  sizeOrder: string[];
  installmentsText: string | null;
  sizeGuide: string | null;
  pickup: { address: string; hours: string } | null;
  shippingConfigured: boolean;
  children: React.ReactNode; // descrição, composição, cuidados (renderizados no servidor)
}) {
  const { add, pending, favorites, toggleFavorite, notify } = useStore();
  const router = useRouter();
  const colors = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const v of props.variants) if (v.colorName && !m.has(v.colorName)) m.set(v.colorName, v.colorHex);
    return [...m].map(([name, hex]) => ({ name, hex }));
  }, [props.variants]);
  const sizes = props.sizeOrder;

  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0].name : colors.find((c) => props.variants.some((v) => v.colorName === c.name && v.available > 0))?.name ?? colors[0]?.name ?? null);
  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [showError, setShowError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const variant = props.variants.find((v) => (colors.length ? v.colorName === color : true) && (sizes.length ? v.size === size : true)) ?? null;
  const needSize = sizes.length > 0 && !size;
  const needColor = colors.length > 0 && !color;
  const soldOut = props.variants.every((v) => v.available <= 0);
  const variantOut = variant ? variant.available <= 0 : false;
  const price = variant?.priceCents ?? props.priceCents;
  const onSale = props.compareAtCents != null && props.compareAtCents > price;
  const fav = favorites.has(props.productId);

  const images = useMemo(() => {
    const byColor = props.images.filter((i) => i.colorName && i.colorName === color);
    const neutral = props.images.filter((i) => !i.colorName);
    return byColor.length ? [...byColor, ...neutral] : props.images;
  }, [props.images, color]);

  const sizeAvailable = (s: string) => props.variants.some((v) => v.size === s && (colors.length ? v.colorName === color : true) && v.available > 0);
  const colorAvailable = (c: string) => props.variants.some((v) => v.colorName === c && v.available > 0);

  async function buy(now: boolean) {
    if (!variant || needSize || needColor) {
      setShowError(true);
      return;
    }
    if (variantOut) return;
    const ok = await add(variant.id, 1);
    if (ok && now) router.push("/checkout");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: props.name, url });
      else {
        await navigator.clipboard.writeText(url);
        notify("Link copiado.");
      }
    } catch {
      /* compartilhamento cancelado */
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
      <div className="lg:col-span-7">
        {/* key: ao trocar de cor, a galeria recomeça na primeira foto */}
        <ProductGallery key={color ?? "todas"} images={images} name={props.name} />
      </div>

      <div className="lg:col-span-5 lg:col-start-8 xl:col-span-4 xl:col-start-9">
        <div className="grid gap-7 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <div className="grid gap-3">
            {props.category && <a href={`/produtos?categoria=${props.category.slug}`} className="w-fit text-sm text-graphite">{props.category.name}</a>}
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.02]">{props.name}</h1>
            <p className="price text-lg">
              {onSale && <s className="mr-3 text-graphite">{formatCents(props.compareAtCents!)}</s>}
              <span className={onSale ? "text-wine" : ""}>{formatCents(price)}</span>
            </p>
            {props.installmentsText && <p className="-mt-1 text-sm text-graphite">{props.installmentsText}</p>}
          </div>

          {colors.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-sm"><span className="font-medium">Cor</span>{color && <span className="text-graphite">: {color}</span>}</legend>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => {
                  const on = c.name === color;
                  const has = colorAvailable(c.name);
                  return (
                    <button key={c.name} type="button" onClick={() => { setColor(c.name); if (size && !props.variants.some((v) => v.colorName === c.name && v.size === size && v.available > 0)) setSize(null); }}
                      aria-pressed={on} aria-label={`${c.name}${has ? "" : ", esgotada"}`}
                      className={`relative size-11 overflow-hidden border transition-[outline-color] ${on ? "outline outline-1 outline-offset-2 outline-ink border-ink" : "border-line"}`}
                      style={{ background: c.hex ?? "var(--color-mist)" }}>
                      {!has && <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-graphite" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {sizes.length > 0 && (
            <fieldset>
              <div className="mb-3 flex items-center justify-between">
                <legend className="text-sm font-medium">Tamanho</legend>
                {props.sizeGuide && (
                  <button type="button" className="flex items-center gap-1.5 text-sm underline underline-offset-4" onClick={() => setGuideOpen(true)}>
                    <IconRuler size={16} /> Guia de medidas
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const has = sizeAvailable(s);
                  const on = s === size;
                  return (
                    <button key={s} type="button" disabled={!has} onClick={() => { setSize(s); setShowError(false); }} aria-pressed={on}
                      aria-label={`Tamanho ${s}${has ? "" : ", esgotado"}`}
                      className={`h-12 min-w-14 px-3 border text-[0.9375rem] font-medium transition-colors disabled:cursor-not-allowed disabled:text-graphite/50 disabled:line-through ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
              {showError && needSize && <p className="error mt-2" role="alert">Escolha um tamanho.</p>}
            </fieldset>
          )}

          <div className="grid gap-3">
            {variant && variant.available > 0 && variant.available <= 2 && <p className="text-sm text-wine">Últimas {variant.available === 1 ? "unidade" : `${variant.available} unidades`} nesta combinação.</p>}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" className="btn btn-solid" onClick={() => buy(false)} disabled={pending || soldOut || variantOut}>
                {soldOut ? "Esgotado" : variantOut ? "Esgotado nesta combinação" : pending ? "Adicionando…" : "Adicionar à sacola"}
              </button>
              <button type="button" onClick={() => toggleFavorite(props.productId)} aria-pressed={fav}
                aria-label={fav ? "Remover dos favoritos" : "Favoritar"} className="btn btn-ghost !px-0 w-12">
                <IconHeart size={20} filled={fav} />
              </button>
            </div>
            {!soldOut && (
              <button type="button" className="btn btn-ghost" onClick={() => buy(true)} disabled={pending || variantOut}>Comprar agora</button>
            )}
          </div>

          <div className="grid gap-5 border-t border-line pt-6">
            <ShippingEstimate variantId={variant?.id ?? null} configured={props.shippingConfigured} />
            {props.pickup && (
              <div className="flex gap-3 text-sm">
                <IconStore size={20} className="mt-0.5 shrink-0" />
                <p><span className="font-medium">Retirada na loja, sem frete.</span> <span className="text-graphite">{props.pickup.address}. {props.pickup.hours}</span></p>
              </div>
            )}
          </div>

          <div className="border-t border-line pt-6">{props.children}</div>

          <button type="button" onClick={share} className="flex w-fit items-center gap-2 text-sm underline underline-offset-4">
            <IconShare size={17} /> Compartilhar
          </button>
        </div>
      </div>

      {/* Barra fixa no celular: aparece só quando o botão principal sai da tela */}
      <MobileBuyBar price={price} disabled={pending || soldOut || variantOut} label={soldOut ? "Esgotado" : "Adicionar"} onBuy={() => buy(false)} />

      {props.sizeGuide && (
        <Drawer open={guideOpen} onClose={() => setGuideOpen(false)} title="Guia de medidas">
          <div className="prose-nd p-5" dangerouslySetInnerHTML={{ __html: props.sizeGuide }} />
        </Drawer>
      )}
    </div>
  );
}

function MobileBuyBar({ price, onBuy, disabled, label }: { price: number; onBuy: () => void; disabled: boolean; label: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="wrap flex items-center justify-between gap-4 py-2.5">
        <span className="price">{formatCents(price)}</span>
        <button type="button" className="btn btn-solid btn-sm min-h-11 px-6" onClick={onBuy} disabled={disabled}>{label}</button>
      </div>
    </div>
  );
}

function ShippingEstimate({ variantId, configured }: { variantId: string | null; configured: boolean }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<QuoteOption[] | null>(null);

  if (!configured) {
    return (
      <div className="flex gap-3 text-sm">
        <IconTruck size={20} className="mt-0.5 shrink-0" />
        <p><span className="font-medium">Entrega para todo o Brasil.</span> <span className="text-graphite">O frete é calculado pelo CEP no carrinho.</span></p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOptions(null);
    if (!variantId) { setError("Escolha cor e tamanho para calcular."); return; }
    if (cep.replace(/\D/g, "").length !== 8) { setError("Digite os 8 números do CEP."); return; }
    setLoading(true);
    const r = await quoteProductShippingAction(variantId, cep);
    setLoading(false);
    if (r.ok) setOptions(r.options);
    else setError(r.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label htmlFor="cep-produto" className="flex items-center gap-2 text-sm font-medium"><IconTruck size={20} /> Calcular frete</label>
      <div className="flex gap-2">
        <input id="cep-produto" className="input" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} aria-invalid={!!error} aria-describedby={error ? "cep-produto-erro" : undefined} />
        <button className="btn btn-ghost shrink-0" disabled={loading}>{loading ? "Calculando…" : "Calcular"}</button>
      </div>
      {error && <p id="cep-produto-erro" className="error" role="alert">{error}</p>}
      {options && (
        <ul className="grid gap-1.5 text-sm">
          {options.map((o) => (
            <li key={o.id} className="flex justify-between gap-4">
              <span>{o.serviceName}{o.carrier ? ` (${o.carrier})` : ""} · {o.daysMin === o.daysMax ? `${o.daysMax}` : `${o.daysMin} a ${o.daysMax}`} dias úteis</span>
              <span className="price">{o.priceCents === 0 ? "Grátis" : formatCents(o.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <a href="https://buscacepinter.correios.com.br/" target="_blank" rel="noopener" className="w-fit text-xs text-graphite underline underline-offset-4">Não sei meu CEP</a>
    </form>
  );
}
