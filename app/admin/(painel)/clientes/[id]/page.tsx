import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { maskCEP, maskPhone, redactCPF } from "@/lib/br";
import { STATUS_LABEL } from "@/server/orders";
import { STATUS_TONE } from "@/server/admin-status";
import { PageHeader, Panel, Pill, Table } from "@/components/admin/ui";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" } }, addresses: true },
  });
  if (!c) notFound();
  const paid = c.orders.filter((o) => o.paidAt);
  return (
    <>
      <PageHeader title={c.fullName} back={{ href: "/admin/clientes", label: "Clientes" }} description={`Cliente desde ${dt.format(c.createdAt)}${c.userId ? " · tem conta" : " · comprou como visitante"}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <div className="grid content-start gap-6">
          <Panel title="Contato">
            <div className="grid gap-1 text-sm">
              <p className="select-all">{c.email}</p>
              {c.phone && <p className="price">{maskPhone(c.phone)} · <a className="link" href={`https://wa.me/55${c.phone}`} target="_blank" rel="noopener">WhatsApp</a></p>}
              <p className="price text-graphite">CPF {redactCPF(c.cpf)}</p>
              <p className="text-graphite">{c.marketingOptIn ? "Aceitou receber novidades" : "Não aceitou receber novidades"}</p>
            </div>
          </Panel>
          <Panel title="Resumo">
            <p className="price text-2xl">{formatCents(paid.reduce((s, o) => s + o.totalCents, 0))}</p>
            <p className="text-sm text-graphite">{paid.length} pedidos pagos de {c.orders.length}</p>
          </Panel>
          {c.addresses.length > 0 && (
            <Panel title="Endereços">
              <ul className="grid gap-3 text-sm">
                {c.addresses.map((a) => <li key={a.id}>{a.street}, {a.number}{a.complement ? `, ${a.complement}` : ""}<span className="block text-graphite">{a.neighborhood} · {a.city}/{a.state} · {maskCEP(a.cep)}</span></li>)}
              </ul>
            </Panel>
          )}
        </div>
        <div>
          <h2 className="mb-4 text-lg font-medium">Pedidos</h2>
          <Table>
            <thead><tr><th>Pedido</th><th>Data</th><th>Total</th><th>Situação</th></tr></thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/pedidos/${o.number}`} className="price underline underline-offset-4">{o.number}</Link></td>
                  <td className="price">{dt.format(o.createdAt)}</td>
                  <td className="price">{formatCents(o.totalCents)}</td>
                  <td><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  );
}
