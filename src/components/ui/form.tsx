"use client";

import { useFormStatus } from "react-dom";

export function Submit({ children, pendingText, className = "btn btn-solid" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? "Salvando…" : children}
    </button>
  );
}

export function TextField({
  name, label, error, hint, className = "", defaultValue, ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; error?: string; hint?: string }) {
  const id = rest.id ?? `f-${name}`;
  const noSpell = rest.type === "email" || rest.type === "password" || /email|cpf|cnpj|code|sku|slug|cep/i.test(name);
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} className="input" defaultValue={defaultValue} spellCheck={noSpell ? false : undefined} aria-invalid={!!error} aria-describedby={error ? `${id}-erro` : hint ? `${id}-dica` : undefined} {...rest} />
      {error ? <p id={`${id}-erro`} className="error" role="alert">{error}</p> : hint ? <p id={`${id}-dica`} className="hint">{hint}</p> : null}
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; message?: string; ok?: boolean } | null }) {
  if (!state) return null;
  if (state.error) return <p className="border border-wine bg-white p-3 text-sm text-wine" role="alert">{state.error}</p>;
  if (state.message) return <p className="border border-ink bg-white p-3 text-sm" role="status">{state.message}</p>;
  return null;
}
