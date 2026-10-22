"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { payCardAction, payPixAction } from "@/app/actions/checkout";
import { IconLock } from "../icons";

type Method = "pix" | "card";

type BrickController = { unmount: () => void };
type MPInstance = { bricks: () => { create: (name: string, target: string, settings: unknown) => Promise<BrickController> } };
declare global {
  interface Window { MercadoPago?: new (key: string, opts: { locale: string }) => MPInstance }
}

export function PaymentChooser({
  orderId, token, amountCents, email, publicKey, maxInstallments, pixMinutes,
}: { orderId: string; token: string; amountCents: number; email: string; publicKey: string; maxInstallments: number; pixMinutes: number }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && !!window.MercadoPago);
  const [brickReady, setBrickReady] = useState(false);
  const controller = useRef<BrickController | null>(null);

  // Formulário seguro do Mercado Pago: os dados do cartão nunca passam pelo nosso servidor
  useEffect(() => {
    if (method !== "card" || !sdkReady || !window.MercadoPago) return;
    let cancelled = false;
    const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
    mp.bricks()
      .create("cardPayment", "mp-card-brick", {
        initialization: { amount: amountCents / 100, payer: { email } },
        customization: {
          paymentMethods: { maxInstallments: Math.max(1, maxInstallments), types: { included: ["credit_card", "debit_card"] } },
          visual: { style: { theme: "flat", customVariables: { baseColor: "#0a0a0a", borderRadiusMedium: "2px", borderRadiusLarge: "2px", fontWeightSemiBold: "500" } } },
        },
        callbacks: {
          onReady: () => !cancelled && setBrickReady(true),
          onError: (e: { message?: string; type?: string }) => {
            console.error("[brick]", e);
            if (e.type === "critical") setError("Não foi possível carregar o formulário do cartão. Recarregue a página ou pague com Pix.");
          },
          onSubmit: async (data: unknown) => {
            setError(null);
            const attempt = `${Date.now()}`;
            const r = await payCardAction(orderId, token, data, attempt);
            if (r.ok) { router.push(r.url); return; }
            setError(r.error);
            throw new Error(r.error); // mantém o formulário aberto para corrigir
          },
        },
      })
      .then((c) => {
        if (cancelled) c.unmount();
        else controller.current = c;
      })
      .catch((e) => { console.error(e); setError("Não foi possível carregar o pagamento com cartão."); });
    return () => {
      cancelled = true;
      controller.current?.unmount();
      controller.current = null;
    };
  }, [method, sdkReady, publicKey, amountCents, email, maxInstallments, orderId, token, router]);

  async function pix() {
    setBusy(true);
    setError(null);
    const r = await payPixAction(orderId, token);
    if (r.ok) router.push(r.url);
    else { setBusy(false); setError(r.error); }
  }

  return (
    <div className="grid gap-6">
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} />
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-medium">Forma de pagamento</legend>
        <MethodOption checked={method === "pix"} onChange={() => setMethod("pix")} title="Pix" text={`Aprovação na hora. O código vale por ${pixMinutes} minutos.`} />
        <MethodOption checked={method === "card"} onChange={() => { setBrickReady(false); setMethod("card"); }} title="Cartão" text={maxInstallments > 1 ? `Crédito em até ${maxInstallments}x, ou débito` : "Crédito ou débito"} />
      </fieldset>

      {error && <p className="border border-wine bg-white p-4 text-wine" role="alert">{error}</p>}

      {method === "pix" ? (
        <div className="grid gap-4">
          <p className="text-graphite">Ao gerar o Pix, você recebe um QR Code e um código para copiar e colar no app do banco. O pedido é confirmado assim que o pagamento cai.</p>
          <button type="button" className="btn btn-solid w-full sm:w-fit" onClick={pix} disabled={busy}>{busy ? "Gerando Pix…" : "Gerar Pix"}</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {!brickReady && <p className="hint">Carregando formulário seguro…</p>}
          <div id="mp-card-brick" className="min-h-[24rem]" />
        </div>
      )}

      <p className="flex items-center gap-2 text-sm text-graphite"><IconLock size={16} /> Pagamento processado pelo Mercado Pago. Não guardamos dados do cartão.</p>
    </div>
  );
}

function MethodOption({ checked, onChange, title, text }: { checked: boolean; onChange: () => void; title: string; text: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 border bg-white p-4 transition-colors ${checked ? "border-ink" : "border-line"}`}>
      <input type="radio" name="method" checked={checked} onChange={onChange} className="mt-1 size-4 accent-ink" />
      <span className="grid"><span className="font-medium">{title}</span><span className="text-sm text-graphite">{text}</span></span>
    </label>
  );
}
