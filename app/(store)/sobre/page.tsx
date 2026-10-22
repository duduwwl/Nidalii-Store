import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { TextPage } from "@/components/store/text-page";

export const metadata: Metadata = { title: "Sobre a loja", alternates: { canonical: "/sobre" } };

export default async function SobrePage() {
  const s = await getSettings();
  const text = s.aboutText ?? "A Nidalii Store é uma loja de moda feminina com peças modernas, elegantes e versáteis, com entrega para todo o Brasil.";
  return (
    <TextPage title="Sobre a Nidalii" markdown={text}>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
        {s.instagramUrl && <a href={s.instagramUrl} target="_blank" rel="noopener" className="btn btn-ghost">Instagram</a>}
      </div>
    </TextPage>
  );
}
