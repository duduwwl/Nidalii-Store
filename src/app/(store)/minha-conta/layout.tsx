import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { signOutAction } from "@/app/actions/account";
import { AccountNav } from "@/components/store/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  if (!user.customer) {
    // conta da equipe sem cadastro de cliente
    return (
      <div className="wrap pt-12">
        <p className="text-graphite">Esta conta é da equipe da loja. <Link href="/admin" className="link">Ir para o painel</Link></p>
      </div>
    );
  }
  return (
    <div className="wrap grid gap-10 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-14">
      <aside className="lg:col-span-3">
        <p className="font-display text-[2rem] leading-tight">Olá, {user.customer.fullName.split(" ")[0]}</p>
        <AccountNav />
        <form action={signOutAction} className="mt-6"><button className="text-sm underline underline-offset-4">Sair</button></form>
      </aside>
      <div className="min-w-0 lg:col-span-8 lg:col-start-5">{children}</div>
    </div>
  );
}
