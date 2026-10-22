import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="wrap grid max-w-xl gap-6 pt-10 lg:pt-16">
      <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.95]">Nova senha</h1>
      {token ? <ResetPasswordForm token={token} /> : <p className="text-graphite">Link incompleto. <Link href="/recuperar-senha" className="link">Peça um novo link</Link>.</p>}
    </div>
  );
}
