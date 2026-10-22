import Link from "next/link";
import type { Settings } from "@/server/settings";
import { maskPhone } from "@/lib/br";
import { IconInstagram } from "../icons";
import type { NavCategory } from "./header";

export function Footer({ settings: s, categories }: { settings: Settings; categories: NavCategory[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-[var(--section)] bg-ink text-white">
      <div className="wrap grid gap-12 py-16 lg:grid-cols-12 lg:gap-6 lg:py-20">
        <div className="grid content-start gap-5 lg:col-span-4">
          <p className="font-display text-[2.5rem] leading-none tracking-[0.14em] lg:text-[3.25rem]">NIDALII</p>
          <p className="max-w-[34ch] text-white/70">Moda feminina com entrega para todo o Brasil{s.pickupAvailable ? " e retirada na loja" : ""}.</p>
          {s.instagramUrl && (
            <a href={s.instagramUrl} target="_blank" rel="noopener" className="flex w-fit items-center gap-2 text-white/90 hover:text-white">
              <IconInstagram size={20} /> @nidaliistore
            </a>
          )}
        </div>

        <FooterCol title="Comprar" className="lg:col-span-2">
          <li><Link href="/produtos">Todos os produtos</Link></li>
          <li><Link href="/novidades">Novidades</Link></li>
          <li><Link href="/colecoes">Coleções</Link></li>
          {categories.slice(0, 6).map((c) => (
            <li key={c.slug}><Link href={`/produtos?categoria=${c.slug}`}>{c.name}</Link></li>
          ))}
        </FooterCol>

        <FooterCol title="Ajuda" className="lg:col-span-2">
          <li><Link href="/entregas">Entregas e retirada</Link></li>
          <li><Link href="/trocas-e-devolucoes">Trocas e devoluções</Link></li>
          <li><Link href="/contato">Contato</Link></li>
          <li><Link href="/minha-conta/pedidos">Meus pedidos</Link></li>
        </FooterCol>

        <div className="grid content-start gap-4 text-white/80 lg:col-span-4">
          <p className="text-sm text-white/50">Atendimento</p>
          {s.hours.length > 0 && (
            <ul className="grid gap-1">
              {s.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-6 max-w-xs"><span>{h.days}</span><span className="price">{h.open} às {h.close}</span></li>
              ))}
            </ul>
          )}
          {s.whatsapp && <p>WhatsApp <span className="price">{maskPhone(s.whatsapp)}</span></p>}
          {s.contactEmail && <p className="break-all">{s.contactEmail}</p>}
          {s.storeAddress && <p>{s.storeAddress}</p>}
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="wrap flex flex-col gap-3 py-6 text-sm text-white/55 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {year} {s.legalName ?? "Nidalii Store"}
            {s.cnpj ? ` · CNPJ ${s.cnpj}` : ""}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li><Link href="/politica-de-privacidade" className="hover:text-white">Privacidade</Link></li>
            <li><Link href="/termos-de-uso" className="hover:text-white">Termos de uso</Link></li>
            <li><Link href="/sobre" className="hover:text-white">Sobre a loja</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title} className={`grid content-start gap-4 ${className ?? ""}`}>
      <p className="text-sm text-white/50">{title}</p>
      <ul className="grid gap-2.5 text-white/85 [&_a:hover]:text-white">{children}</ul>
    </nav>
  );
}
