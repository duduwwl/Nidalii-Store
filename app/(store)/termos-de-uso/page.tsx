import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { DEFAULT_TEXTS } from "@/server/default-texts";
import { TextPage } from "@/components/store/text-page";

export const metadata: Metadata = { title: "Termos de uso", alternates: { canonical: "/termos-de-uso" } };

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Termos de uso" markdown={s.termsOfUse ?? DEFAULT_TEXTS.termsOfUse} />;
}
