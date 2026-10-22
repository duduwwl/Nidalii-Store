import type { Metadata } from "next";
import { requireCustomer } from "@/lib/auth";
import { ProfileForm, DeleteAccountForm } from "@/components/store/account-forms";
import { maskCPF, maskPhone } from "@/lib/br";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function MinhaContaPage() {
  const user = await requireCustomer();
  const c = user.customer!;
  return (
    <div className="grid gap-14">
      <section className="grid gap-6" aria-labelledby="t-dados">
        <h1 id="t-dados" className="font-display text-2xl">Dados pessoais</h1>
        <ProfileForm email={user.email} fullName={c.fullName} cpf={c.cpf ? maskCPF(c.cpf) : ""} phone={c.phone ? maskPhone(c.phone) : ""} marketing={c.marketingOptIn} />
      </section>
      <section className="grid gap-4 border-t border-line pt-8" aria-labelledby="t-excluir">
        <h2 id="t-excluir" className="font-display text-xl">Excluir conta</h2>
        <p className="max-w-[60ch] text-graphite">Removemos seus dados pessoais e endereços. Pedidos já feitos continuam registrados, sem seu nome, porque a lei exige guardar o histórico fiscal.</p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
