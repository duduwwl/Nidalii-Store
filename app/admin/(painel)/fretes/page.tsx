import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/ui";
import { ShippingForm } from "@/components/admin/settings-forms";

type MeServiceInfo = { id: number; name: string; company?: { name: string } };

/** Lista de serviços direto do Melhor Envio, para não depender de ids decorados. */
async function meServices(): Promise<MeServiceInfo[] | null> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) return null;
  const base = process.env.MELHOR_ENVIO_ENV === "production" ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";
  try {
    const res = await fetch(`${base}/api/v2/me/shipment/services`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "User-Agent": `Nidalii Store (${process.env.MELHOR_ENVIO_CONTACT_EMAIL ?? "contato"})` },
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as MeServiceInfo[];
  } catch {
    return null;
  }
}

export default async function FretesPage() {
  await requireAdmin();
  const [s, services] = await Promise.all([getSettings(), meServices()]);
  return (
    <>
      <PageHeader title="Frete e retirada" description="O frete é cotado no Melhor Envio com o peso e as medidas de cada peça. Nenhum valor é inventado: sem configuração, a loja não mostra frete." />
      <ShippingForm
        tokenConfigured={!!process.env.MELHOR_ENVIO_TOKEN}
        env={process.env.MELHOR_ENVIO_ENV === "production" ? "produção" : "sandbox (testes)"}
        services={services?.map((x) => ({ id: String(x.id), name: x.name, company: x.company?.name ?? "" })) ?? null}
        s={{
          originCep: s.originCep ?? "", defaultWeightGrams: s.defaultWeightGrams, defaultLengthCm: s.defaultLengthCm, defaultWidthCm: s.defaultWidthCm, defaultHeightCm: s.defaultHeightCm,
          enabledShippingServices: s.enabledShippingServices, freeShippingMinCents: s.freeShippingMinCents,
          pickupEnabled: s.pickupEnabled, storeStreet: s.storeStreet ?? "", storeNumber: s.storeNumber ?? "", storeComplement: s.storeComplement ?? "",
          storeNeighborhood: s.storeNeighborhood ?? "", storeCity: s.storeCity ?? "", storeState: s.storeState ?? "", storeCep: s.storeCep ?? "",
          hours: s.hours, pickupInstructions: s.pickupInstructions ?? "",
        }}
      />
    </>
  );
}
