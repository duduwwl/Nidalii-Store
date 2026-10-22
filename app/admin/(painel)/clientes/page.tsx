import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { onlyDigits } from "@/lib/br";
import { Empty, PageHeader, Table } from "@/components/admin/ui";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; conta?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const digits = q ? onlyDigits(q) : "";
  const where: Prisma.CustomerWhereInput = {
    email: { not: { endsWith: "@invalid" } },
    ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }, { cpf: { startsWith: digits } }] : [])] } : {}),
    ...(sp.conta === "1" ? { userId: { not: null } } : {}),
  };
  const customers = await db.customer.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    include: { orders: { where: { paidAt: { not: null } }, select: { totalCents: true, createdAt: true } }, _count: { select: { orders: true } } },
  });
  return (
    <>
      <PageHeader title="Clientes" description="Dados pessoais usados só para atendimento e entrega. O CPF aparece parcialmente oculto." />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar cliente</label>
        <input id="q" name="q" defaultValue={q} className="input max-w-sm" placeholder="Nome, e-mail ou telefone…" />
        <label className="check self-center text-sm"><input type="checkbox" name="conta" value="1" defaultChecked={sp.conta === "1"} /><span>Só com conta</span></label>
        <button className="btn btn-ghost">Buscar</button>
      </form>
      {customers.length === 0 ? <Empty><p>Nenhuma cliente encontrada.</p></Empty> : (
        <Table>
          <thead><tr><th>Cliente</th><th>Conta</th><th>Pedidos</th><th>Total pago</th><th>Marketing</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/clientes/${c.id}`} className="font-medium hover:underline">{c.fullName}</Link><span className="block text-xs text-graphite">{c.email}</span></td>
                <td>{c.userId ? "Sim" : "Visitante"}</td>
                <td className="price">{c._count.orders}</td>
                <td className="price">{formatCents(c.orders.reduce((s, o) => s + o.totalCents, 0))}</td>
                <td>{c.marketingOptIn ? "Aceitou" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
