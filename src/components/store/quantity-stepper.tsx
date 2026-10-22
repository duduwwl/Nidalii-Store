"use client";

import { IconMinus, IconPlus } from "../icons";

export function QuantityStepper({
  value, max, onChange, disabled, label,
}: { value: number; max: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  return (
    <div className="inline-flex items-center border border-line" role="group" aria-label={label}>
      <button
        type="button" className="grid size-11 place-items-center disabled:opacity-40"
        onClick={() => onChange(value - 1)} disabled={disabled || value <= 1} aria-label="Diminuir"
      >
        <IconMinus size={16} />
      </button>
      <span className="price w-8 text-center text-sm" aria-live="polite">{value}</span>
      <button
        type="button" className="grid size-11 place-items-center disabled:opacity-40"
        onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Aumentar"
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}
