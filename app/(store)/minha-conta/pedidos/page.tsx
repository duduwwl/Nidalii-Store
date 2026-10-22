import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { STATUS_LABEL } from "@/server/orders";

export const metadata: Metadata = { title: "Meus pedidos", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default async function PedidosPage() {
  const user = await requireCustomer("/minha-conta/pedidos");
  const orders = await db.order.findMany({
    where: { customerId: user.customer!.id },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantity: true } } },
  });
  return (
    <section className="grid gap-6" aria-labelledby="t-ped">
      <h1 id="t-ped" className="font-display text-2xl">Meus pedidos</h1>
      {orders.length === 0 ? (
        <div className="grid justify-items-start gap-4">
          <p className="text-graphite">Você ainda não fez pedidos com esta conta.</p>
          <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/minha-conta/pedidos/${o.number}`} className="grid grid-cols-2 gap-2 py-5 sm:grid-cols-4 sm:items-center">
                <span className="font-medium">Pedido {o.number}</span>
                <span className="text-right text-sm text-graphite sm:text-left">{dateFmt.format(o.createdAt)}</span>
                <span className="text-sm">{STATUS_LABEL[o.status]}</span>
                <span className="price text-right">{formatCents(o.totalCents)} <span className="text-sm text-graphite">· {o.items.reduce((n, i) => n + i.quantity, 0)} un.</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
