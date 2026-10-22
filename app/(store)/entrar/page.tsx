import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { SignInForm, SignUpForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

type Props = { searchParams: Promise<{ voltar?: string; criar?: string }> };

export default async function EntrarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sp.voltar?.startsWith("/") && !sp.voltar.startsWith("//") ? sp.voltar : "/minha-conta";
  if ((await currentUser())?.customer) redirect(next);
  const creating = sp.criar === "1";

  return (
    <div className="wrap grid gap-14 pt-10 lg:grid-cols-12 lg:gap-6 lg:pt-16">
      <section className="grid content-start gap-6 lg:col-span-5" aria-labelledby="t-entrar">
        <h1 id="t-entrar" className="font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">{creating ? "Criar conta" : "Entrar"}</h1>
        {creating ? <SignUpForm next={next} /> : <SignInForm next={next} />}
        <p className="text-sm text-graphite">
          {creating ? <>Já tem conta? <Link href={`/entrar?voltar=${encodeURIComponent(next)}`} className="link">Entrar</Link></> : <>Primeira compra? <Link href={`/entrar?criar=1&voltar=${encodeURIComponent(next)}`} className="link">Criar conta</Link></>}
        </p>
      </section>
      <aside className="grid content-start gap-4 border-t border-line pt-8 lg:col-span-4 lg:col-start-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-4">
        <h2 className="font-display text-[1.75rem]">Com a conta você</h2>
        <ul className="grid gap-2 text-graphite">
          <li>acompanha seus pedidos;</li>
          <li>salva endereços para comprar mais rápido;</li>
          <li>guarda seus favoritos em qualquer aparelho.</li>
        </ul>
        <p className="text-sm text-graphite">Também dá para comprar sem cadastro: é só seguir para o checkout.</p>
      </aside>
    </div>
  );
}
