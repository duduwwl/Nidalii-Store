"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="wrap grid justify-items-start gap-6 py-20 lg:py-32">
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">Algo deu errado nesta página.</h1>
      <p className="max-w-[48ch] text-graphite">Seu carrinho continua salvo. Tente carregar de novo; se o problema continuar, fale com a loja.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="btn btn-solid">Tentar de novo</button>
        <Link href="/" className="btn btn-ghost">Página inicial</Link>
      </div>
    </div>
  );
}
