import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { AddressList } from "@/components/store/account-forms";

export const metadata: Metadata = { title: "Endereços", robots: { index: false } };

export default async function EnderecosPage() {
  const user = await requireCustomer("/minha-conta/enderecos");
  const addresses = await db.address.findMany({ where: { customerId: user.customer!.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  return (
    <section className="grid gap-6" aria-labelledby="t-end">
      <h1 id="t-end" className="font-display text-2xl">Endereços</h1>
      <AddressList addresses={addresses} />
    </section>
  );
}
