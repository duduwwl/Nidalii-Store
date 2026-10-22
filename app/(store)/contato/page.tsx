import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { maskPhone, onlyDigits } from "@/lib/br";
import { IconChat, IconInstagram, IconStore } from "@/components/icons";

export const metadata: Metadata = { title: "Contato", alternates: { canonical: "/contato" } };

export default async function ContatoPage() {
  const s = await getSettings();
  const wa = s.whatsapp ? onlyDigits(s.whatsapp) : null;
  return (
    <div className="wrap grid gap-10 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-14">
      <div className="grid content-start gap-5 lg:col-span-5">
        <h1 className="font-display text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.95]">Atendimento</h1>
        <p className="max-w-[40ch] text-lg text-graphite">Dúvidas sobre tamanhos, pedidos ou trocas? Fale com a loja pelos canais abaixo.</p>
        {s.hours.length > 0 && (
          <dl className="mt-4 grid max-w-sm gap-2">
            {s.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-6 border-b border-line pb-2"><dt>{h.days}</dt><dd className="price">{h.open} às {h.close}</dd></div>
            ))}
          </dl>
        )}
      </div>
      <ul className="grid content-start gap-px bg-line lg:col-span-6 lg:col-start-7">
        {wa && (
          <li className="bg-paper">
            <a href={`https://wa.me/55${wa}`} target="_blank" rel="noopener" className="flex items-center gap-4 p-6">
              <IconChat size={24} /><span className="grid"><span className="font-medium">WhatsApp</span><span className="price text-graphite">{maskPhone(wa)}</span></span>
            </a>
          </li>
        )}
        {s.instagramUrl && (
          <li className="bg-paper">
            <a href={s.instagramUrl} target="_blank" rel="noopener" className="flex items-center gap-4 p-6">
              <IconInstagram size={24} /><span className="grid"><span className="font-medium">Instagram</span><span className="text-graphite">@nidaliistore</span></span>
            </a>
          </li>
        )}
        {s.contactEmail && (
          <li className="bg-paper"><div className="flex items-center gap-4 p-6"><span className="grid"><span className="font-medium">E-mail</span><span className="select-all text-graphite">{s.contactEmail}</span></span></div></li>
        )}
        {s.storeAddress && (
          <li className="bg-paper">
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.storeAddress)}`} target="_blank" rel="noopener" className="flex items-center gap-4 p-6">
              <IconStore size={24} /><span className="grid"><span className="font-medium">Loja física</span><span className="text-graphite">{s.storeAddress}</span></span>
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
