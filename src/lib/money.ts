const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos como "R$ 1.234,56". */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte "129,90" ou "129.90" ou "1.299,90" em centavos. Retorna null se inválido. */
export function parseBRLToCents(input: string): number | null {
  const raw = input.replace(/[R$\s]/g, "").trim();
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
