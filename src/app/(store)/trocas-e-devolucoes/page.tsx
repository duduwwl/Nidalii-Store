import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { DEFAULT_TEXTS } from "@/server/default-texts";
import { TextPage } from "@/components/store/text-page";

export const metadata: Metadata = { title: "Trocas e devoluções", alternates: { canonical: "/trocas-e-devolucoes" } };

export default async function Page() {
  const s = await getSettings();
  return <TextPage title="Trocas e devoluções" markdown={s.returnsPolicy ?? DEFAULT_TEXTS.returnsPolicy} />;
}
