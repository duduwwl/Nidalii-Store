import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AdminLoginForm } from "./form";

export const metadata: Metadata = { title: "Painel · Entrar", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user && (user.role === "ADMIN" || user.role === "STAFF")) redirect("/admin");
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="grid w-full max-w-sm gap-8">
        <div className="grid gap-2">
          <p className="font-display text-[1.75rem] tracking-[0.18em]">NIDALII</p>
          <h1 className="text-lg text-graphite">Painel da loja</h1>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
