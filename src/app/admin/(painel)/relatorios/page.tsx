import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { revenueByDay, sinceDays, topProducts } from "@/server/reports";
import { PageHeader, Panel, Table } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/bar-chart";

const PERIODS = [7, 30, 90] as const;

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const d = Number((await searchParams).dias);
  const days = (PERIODS as readonly number[]).includes(d) ? d : 30;
  const since = sinceDays(days);
  const [series, top, byMethod, byFulfil, coupons] = await Promise.all([
    revenueByDay(days),
    topProducts(days),
    db.payment.groupBy({ by: ["method"], where: { status: "APPROVED", createdAt: { gte: since } }, _sum: { amountCents: true }, _count: true }),
    db.order.groupBy({ by: ["fulfillment"], where: { paidAt: { gte: since } }, _count: true }),
    db.couponRedemption.groupBy({ by: ["couponId"], where: { order: { paidAt: { gte: since } } }, _sum: { discountCents: true }, _count: true }),
  ]);
  const couponNames = coupons.length ? await db.coupon.findMany({ where: { id: { in: coupons.map((c) => c.couponId) } }, select: { id: true, code: true } }) : [];
  const revenue = series.reduce((s, x) => s + x.value, 0);
  const orders = series.reduce((s, x) => s + x.orders, 0);
  const METHOD = { PIX: "Pix", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito" } as const;

  return (
    <>
      <PageHeader title="Relatórios" description="Somente pedidos com pagamento aprovado. Reembolsos saem da receita."
        actions={PERIODS.map((p) => <Link key={p} href={`?dias=${p}`} className={`btn btn-sm ${p === days ? "btn-solid" : "btn-ghost"}`}>{p} dias</Link>)} />
      <div className="mb-6 grid grid-cols-2 gap-px bg-line lg:grid-cols-3">
        <div className="bg-white p-5"><p className="text-sm text-graphite">Receita</p><p className="price mt-1 text-[1.625rem]">{formatCents(revenue)}</p></div>
        <div className="bg-white p-5"><p className="text-sm text-graphite">Pedidos pagos</p><p className="price mt-1 text-[1.625rem]">{orders}</p></div>
        <div className="col-span-2 bg-white p-5 lg:col-span-1"><p className="text-sm text-graphite">Ticket médio</p><p className="price mt-1 text-[1.625rem]">{orders ? formatCents(Math.round(revenue / orders)) : "—"}</p></div>
      </div>
      <Panel className="mb-6"><RevenueChart data={series} title={`Receita por dia, últimos ${days} dias`} /></Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-medium">Mais vendidos</h2>
          {top.length === 0 ? <p className="text-graphite">Sem vendas no período.</p> : (
            <Table><thead><tr><th>Produto</th><th>Unidades</th><th>Receita</th></tr></thead>
              <tbody>{top.map((t) => <tr key={t.name}><td>{t.name}</td><td className="price">{t.units}</td><td className="price">{formatCents(t.revenueCents)}</td></tr>)}</tbody></Table>
          )}
        </section>
        <div className="grid content-start gap-6">
          <Panel title="Formas de pagamento">
            {byMethod.length === 0 ? <p className="text-sm text-graphite">Sem pagamentos aprovados.</p> : (
              <ul className="grid gap-2 text-sm">{byMethod.map((m) => <li key={m.method} className="flex justify-between"><span>{METHOD[m.method]} · {m._count}</span><span className="price">{formatCents(m._sum.amountCents ?? 0)}</span></li>)}</ul>
            )}
          </Panel>
          <Panel title="Entrega e retirada">
            {byFulfil.length === 0 ? <p className="text-sm text-graphite">Sem pedidos pagos.</p> : (
              <ul className="grid gap-2 text-sm">{byFulfil.map((f) => <li key={f.fulfillment} className="flex justify-between"><span>{f.fulfillment === "PICKUP" ? "Retirada na loja" : "Entrega"}</span><span className="price">{f._count}</span></li>)}</ul>
            )}
          </Panel>
          <Panel title="Cupons">
            {coupons.length === 0 ? <p className="text-sm text-graphite">Nenhum cupom usado.</p> : (
              <ul className="grid gap-2 text-sm">{coupons.map((c) => <li key={c.couponId} className="flex justify-between"><span>{couponNames.find((n) => n.id === c.couponId)?.code} · {c._count} usos</span><span className="price">− {formatCents(c._sum.discountCents ?? 0)}</span></li>)}</ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
