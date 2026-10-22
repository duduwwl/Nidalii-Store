import Link from "next/link";
import type { OrderStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { STATUS_LABEL } from "@/server/orders";
import { STATUS_TONE } from "@/server/admin-status";
import { Empty, PageHeader, Pill, Table } from "@/components/admin/ui";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const TABS: { label: string; status?: OrderStatus[] }[] = [
  { label: "Para separar", status: ["PAID", "PREPARING"] },
  { label: "Retirada", status: ["READY_FOR_PICKUP"] },
  { label: "Enviados", status: ["SHIPPED"] },
  { label: "Aguardando pagamento", status: ["AWAITING_PAYMENT", "PAYMENT_FAILED"] },
  { label: "Concluídos", status: ["DELIVERED", "PICKED_UP"] },
  { label: "Cancelados", status: ["CANCELED", "REFUNDED"] },
  { label: "Todos" },
];

export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<{ aba?: string; status?: string; q?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const tab = sp.status ? null : Number(sp.aba ?? 0);
  const statuses = sp.status ? [sp.status as OrderStatus] : TABS[tab ?? 0]?.status;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(q ? { OR: [...(/^\d+$/.test(q) ? [{ number: Number(q) }] : []), { customer: { fullName: { contains: q, mode: "insensitive" } } }, { customer: { email: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [orders, total, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { customer: { select: { fullName: true } }, items: { select: { quantity: true } } } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const countFor = (s?: OrderStatus[]) => (s ? counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count, 0) : counts.reduce((n, c) => n + c._count, 0));

  return (
    <>
      <PageHeader title="Pedidos" />
      <nav aria-label="Filtrar pedidos" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t, i) => (
          <Link key={t.label} href={`/admin/pedidos?aba=${i}`} aria-current={tab === i ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${tab === i ? "border-ink font-medium" : "border-transparent text-graphite"}`}>
            {t.label} <span className="price text-xs">{countFor(t.status)}</span>
          </Link>
        ))}
      </nav>
      <form className="mb-5 flex gap-2" role="search">
        {tab != null && <input type="hidden" name="aba" value={tab} />}
        <label htmlFor="q" className="sr-only">Buscar pedido</label>
        <input id="q" name="q" defaultValue={q} placeholder="Número, nome ou e-mail…" className="input max-w-sm" />
        <button className="btn btn-ghost">Buscar</button>
      </form>
      {orders.length === 0 ? (
        <Empty><p>Nenhum pedido aqui.</p></Empty>
      ) : (
        <Table>
          <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Entrega</th><th>Total</th><th>Situação</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/pedidos/${o.number}`} className="price font-medium underline underline-offset-4">{o.number}</Link></td>
                <td>{o.customer.fullName}<span className="block text-xs text-graphite">{o.items.reduce((n, i) => n + i.quantity, 0)} un.</span></td>
                <td className="price whitespace-nowrap">{dt.format(o.createdAt)}</td>
                <td>{o.fulfillment === "PICKUP" ? "Retirada" : `${o.shipCity ?? ""}/${o.shipState ?? ""}`}</td>
                <td className="price">{formatCents(o.totalCents)}</td>
                <td><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {total > 50 && (
        <div className="mt-4 flex gap-2">
          {page > 1 && <Link className="btn btn-ghost btn-sm" href={`?aba=${tab ?? 0}&pagina=${page - 1}${q ? `&q=${q}` : ""}`}>Anteriores</Link>}
          {page * 50 < total && <Link className="btn btn-ghost btn-sm" href={`?aba=${tab ?? 0}&pagina=${page + 1}${q ? `&q=${q}` : ""}`}>Próximos</Link>}
        </div>
      )}
    </>
  );
}
