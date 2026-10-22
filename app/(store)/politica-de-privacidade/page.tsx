import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { DEFAULT_TEXTS } from "@/server/default-texts";
import { TextPage } from "@/components/store/text-page";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/politica-de-privacidade" } };

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Política de privacidade" markdown={s.privacyPolicy ?? DEFAULT_TEXTS.privacyPolicy} />;
}
