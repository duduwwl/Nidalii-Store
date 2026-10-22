import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

export type OpeningHour = { days: string; open: string; close: string };

export const getSettings = cache(async () => {
  const s = await db.siteSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const hours = Array.isArray(s.openingHours) ? (s.openingHours as OpeningHour[]) : [];
  const storeAddress =
    s.storeStreet && s.storeNumber && s.storeCity && s.storeState
      ? `${s.storeStreet}, ${s.storeNumber}${s.storeComplement ? ` — ${s.storeComplement}` : ""}, ${s.storeNeighborhood ?? ""}, ${s.storeCity}/${s.storeState}`
      : null;
  return {
    ...s,
    hours,
    storeAddress,
    // Retirada só aparece com endereço cadastrado e ligada no painel
    pickupAvailable: s.pickupEnabled && !!storeAddress,
    shippingConfigured:
      !!s.originCep && !!process.env.MELHOR_ENVIO_TOKEN && s.enabledShippingServices.length > 0,
  };
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;
