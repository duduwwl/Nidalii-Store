import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { DEFAULT_TEXTS } from "@/server/default-texts";
import { TextPage } from "@/components/store/text-page";

export const metadata: Metadata = { title: "Entregas e retirada", alternates: { canonical: "/entregas" } };

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Entregas e retirada" markdown={s.shippingPolicy ?? DEFAULT_TEXTS.shippingPolicy} />;
}
