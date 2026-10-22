import type { Metadata } from "next";
import { ResetRequestForm } from "@/components/store/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };

export default function RecuperarSenhaPage() {
  return (
    <div className="wrap grid max-w-xl gap-6 pt-10 lg:pt-16">
      <h1 className="font-display text-[clamp(2.5rem,6vw,4rem)] leading-[0.95]">Recuperar senha</h1>
      <p className="text-graphite">Digite o e-mail da conta. Enviamos um link para você criar uma nova senha.</p>
      <ResetRequestForm />
    </div>
  );
}
