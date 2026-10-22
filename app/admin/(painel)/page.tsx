import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { dashboardStats, revenueByDay } from "@/server/reports";
import { getSettings } from "@/server/settings";
import { mpConfigured } from "@/server/payments/mercadopago";
import { STATUS_LABEL } from "@/server/orders";
import { STATUS_TONE } from "@/server/admin-status";
import { PageHeader, Panel, Pill } from "@/components/admin/ui";
import { RevenueChart } from "@/components/admin/bar-chart";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function DashboardPage() {
  const [stats, series, recent, settings, emailsSkipped] = await Promise.all([
    dashboardStats(),
    revenueByDay(30),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { fullName: true } } } }),
    getSettings(),
    db.emailLog.count({ where: { status: { not: "sent" } } }),
  ]);

  // Pendências de configuração: o que impede a loja de vender de verdade
  const setup = [
    { done: mpConfigured(), text: "Conectar o Mercado Pago (Pix, crédito e débito)", href: "/admin/configuracoes" },
    { done: !!process.env.MP_WEBHOOK_SECRET, text: "Configurar a assinatura do webhook do Mercado Pago", href: "/admin/configuracoes" },
    { done: settings.shippingConfigured, text: "Configurar o Melhor Envio e o CEP de origem", href: "/admin/fretes" },
    { done: settings.pickupAvailable, text: "Cadastrar o endereço da loja para retirada", href: "/admin/fretes" },
    { done: !!process.env.RESEND_API_KEY, text: "Ativar o envio de e-mails aos clientes", href: "/admin/configuracoes" },
    { done: stats.products > 0, text: "Cadastrar os produtos", href: "/admin/produtos/novo" },
    { done: !!settings.legalName && !!settings.cnpj, text: "Informar razão social e CNPJ", href: "/admin/configuracoes" },
  ];
  const pending = setup.filter((s) => !s.done);

  return (
    <>
      <PageHeader title="Visão geral" description="Números calculados a partir dos pedidos registrados." />

      {pending.length > 0 && (
        <Panel title="Para a loja começar a vender" className="mb-6 border border-ink">
          <ul className="grid gap-2">
            {pending.map((s) => (
              <li key={s.text} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
                <span>{s.text}</span>
                <Link href={s.href} className="link text-sm">Resolver</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-6 grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
        <Stat label="Receita confirmada" value={formatCents(stats.revenueCents)} note={`${stats.paidOrders} ${stats.paidOrders === 1 ? "pedido pago" : "pedidos pagos"}`} />
        <Stat label="Para separar" value={String(stats.toFulfil)} note="pagos e em preparação" href="/admin/pedidos?status=PAID" urgent={stats.toFulfil > 0} />
        <Stat label="Aguardando pagamento" value={String(stats.pendingPayment)} note={`${stats.totalOrders} ${stats.totalOrders === 1 ? "pedido" : "pedidos"} no total`} href="/admin/pedidos?status=AWAITING_PAYMENT" />
        <Stat label="Estoque" value={`${stats.soldOut} ${stats.soldOut === 1 ? "esgotada" : "esgotadas"}`} note={`variantes de cor e tamanho · ${stats.lowStock} com estoque baixo · ${stats.products} produtos`} href="/admin/estoque?filtro=baixo" urgent={stats.lowStock + stats.soldOut > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel><RevenueChart data={series} title="Receita confirmada, últimos 30 dias" /></Panel>
        <Panel title="Pedidos recentes" actions={<Link href="/admin/pedidos" className="link text-sm">Todos</Link>}>
          {recent.length === 0 ? (
            <p className="text-graphite">Nenhum pedido ainda.</p>
          ) : (
            <ul className="grid">
              {recent.map((o) => (
                <li key={o.id} className="border-t border-line first:border-0">
                  <Link href={`/admin/pedidos/${o.number}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 text-sm hover:bg-mist">
                    <span className="price font-medium">{o.number}</span>
                    <span className="truncate">{o.customer.fullName}<span className="block text-xs text-graphite">{dt.format(o.createdAt)}</span></span>
                    <span className="grid justify-items-end gap-1"><span className="price">{formatCents(o.totalCents)}</span><Pill tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Pill></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {emailsSkipped > 0 && <p className="mt-6 text-sm text-graphite">{emailsSkipped} e-mails não foram enviados por falta de configuração ou erro. Veja em Configurações.</p>}
    </>
  );
}

function Stat({ label, value, note, href, urgent }: { label: string; value: string; note: string; href?: string; urgent?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-graphite">{label}</p>
      <p className={`price mt-1 text-[1.625rem] leading-tight ${urgent ? "text-wine" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-graphite">{note}</p>
    </>
  );
  return <div className="bg-white">{href ? <Link href={href} className="block p-5 hover:bg-mist">{body}</Link> : <div className="p-5">{body}</div>}</div>;
}
