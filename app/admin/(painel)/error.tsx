"use client";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid justify-items-start gap-4 py-10">
      <h1 className="font-display text-2xl">Não foi possível abrir esta tela.</h1>
      <p className="max-w-[60ch] text-graphite">{error.digest ? `Código do erro: ${error.digest}. ` : ""}Nada foi alterado. Tente de novo; se continuar, envie o código ao suporte técnico.</p>
      <button type="button" onClick={reset} className="btn btn-solid">Tentar de novo</button>
    </div>
  );
}
