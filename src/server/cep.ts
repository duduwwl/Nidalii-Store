import "server-only";

export type CepAddress = { cep: string; street: string; neighborhood: string; city: string; state: string };

/** Consulta o ViaCEP. Retorna null quando o CEP não existe ou o serviço não responde. */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, string | boolean>;
    if (data.erro) return null;
    return {
      cep: digits,
      street: String(data.logradouro ?? ""),
      neighborhood: String(data.bairro ?? ""),
      city: String(data.localidade ?? ""),
      state: String(data.uf ?? ""),
    };
  } catch {
    return null;
  }
}
