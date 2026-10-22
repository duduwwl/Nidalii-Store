"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "../icons";

export function PixPanel({ code, qrBase64, amount, expiresAt, retryUrl }: { code: string; qrBase64: string | null; amount: string; expiresAt: string | null; retryUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const end = new Date(expiresAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      (document.getElementById("pix-code") as HTMLTextAreaElement | null)?.select();
    }
  }

  const expired = left === 0;
  const mm = left != null ? String(Math.floor(left / 60)).padStart(2, "0") : "--";
  const ss = left != null ? String(left % 60).padStart(2, "0") : "--";

  if (expired) {
    return (
      <div className="grid justify-items-start gap-4 border border-line bg-white p-6">
        <p className="font-medium">Este código Pix expirou.</p>
        <a href={retryUrl} className="btn btn-solid">Gerar um novo Pix</a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 bg-white p-6 sm:grid-cols-[auto_1fr] sm:items-start lg:p-8">
      {qrBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code do Pix" width={220} height={220} className="size-[13.75rem] justify-self-center border border-line" />
      )}
      <div className="grid gap-4">
        <p className="price text-2xl">{amount}</p>
        <p className="text-sm text-graphite">Abra o app do banco, escolha Pix e escaneie o código, ou copie o código abaixo.</p>
        <label htmlFor="pix-code" className="label">Pix copia e cola</label>
        <textarea id="pix-code" readOnly value={code} className="textarea !min-h-24 break-all font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={copy} className="btn btn-solid w-full sm:w-fit" aria-live="polite">
          {copied ? <><IconCheck size={18} /> Código copiado</> : <><IconCopy size={18} /> Copiar código</>}
        </button>
        {left != null && <p className="price text-sm text-graphite">Expira em {mm}:{ss}</p>}
      </div>
    </div>
  );
}
