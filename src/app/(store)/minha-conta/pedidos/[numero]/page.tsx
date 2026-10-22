import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { OrderDetail } from "@/components/store/order-detail";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default async function PedidoContaPage({ params }: { params: Promise<{ numero: string }> }) {
  const user = await requireCustomer("/minha-conta/pedidos");
  const n = Number((await params).numero);
  if (!Number.isInteger(n)) notFound();
  const order = await db.order.findFirst({
    where: { number: n, customerId: user.customer!.id },
    include: { items: true, shipment: true, statusHistory: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();
  const s = await getSettings();
  return (
    <section className="grid gap-6" aria-labelledby="t-p">
      <Link href="/minha-conta/pedidos" className="w-fit text-sm text-graphite">Meus pedidos</Link>
      <h1 id="t-p" className="font-display text-2xl">Pedido {order.number}</h1>
      <OrderDetail order={order} pickupInfo={s.storeAddress ? `Retirada em ${s.storeAddress}. ${s.pickupInstructions ?? "Leve um documento com foto."}` : null} />
    </section>
  );
}
