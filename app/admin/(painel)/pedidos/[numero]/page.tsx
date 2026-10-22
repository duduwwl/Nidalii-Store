import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { maskCEP, maskCPF, maskPhone } from "@/lib/br";
import { canTransition, STATUS_LABEL } from "@/server/orders";
import { STATUS_TONE } from "@/server/admin-status";
import { PageHeader, Panel, Pill } from "@/components/admin/ui";
import { OrderActions } from "@/components/admin/order-actions";
import type { OrderStatus } from "@prisma/client";

const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const METHOD = { PIX: "Pix", CREDIT_CARD: "Crédito", DEBIT_CARD: "Débito" } as const;
const PAY = { PENDING: "Pendente", AUTHORIZED: "Autorizado", APPROVED: "Aprovado", REJECTED: "Recusado", CANCELED: "Cancelado", REFUNDED: "Estornado", CHARGED_BACK: "Contestado" } as const;

export default async function AdminPedidoPage({ params }: { params: Promise<{ numero: string }> }) {
  const n = Number((await params).numero);
  if (!Number.isInteger(n)) notFound();
  const order = await db.order.findUnique({
    where: { number: n },
    include: {
      customer: true, items: { include: { variant: { select: { productId: true } } } }, payments: { orderBy: { createdAt: "desc" } },
      shipment: true, statusHistory: { orderBy: { createdAt: "desc" } }, couponRedemption: true,
    },
  });
  if (!order) notFound();
  const user = await currentUser();
  const actorIds = [...new Set(order.statusHistory.map((e) => e.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, include: { admin: true } }) : [];
  const actorName = (id: string | null) => (id ? actors.find((a) => a.id === id)?.admin?.displayName ?? "Equipe" : "Sistema");

  const next = (Object.keys(STATUS_LABEL) as OrderStatus[]).filter((s) => s !== "PAID" && s !== "REFUNDED" && canTransition(order.status, s))
    .filter((s) => !(s === "SHIPPED" && order.fulfillment === "PICKUP") && !(s === "READY_FOR_PICKUP" && order.fulfillment === "DELIVERY"));
  const canRefund = user?.role === "ADMIN" && order.payments.some((p) => p.status === "APPROVED") && canTransition(order.status, "REFUNDED");
  const emails = await db.emailLog.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <>
      <PageHeader title={`Pedido ${order.number}`} back={{ href: "/admin/pedidos", label: "Pedidos" }}
        actions={<Pill tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Pill>}
        description={`Feito em ${dt.format(order.createdAt)}${order.paidAt ? ` · pago em ${dt.format(order.paidAt)}` : ""}`} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Itens">
            <ul className="grid gap-3">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 border-t border-line pt-3 text-sm first:border-0 first:pt-0">
                  <span><Link href={`/admin/produtos/${i.variant.productId}`} className="font-medium underline-offset-4 hover:underline">{i.productName}</Link><span className="block text-graphite">{[i.colorName, i.size].filter(Boolean).join(" · ")} · SKU {i.sku}</span></span>
                  <span className="price shrink-0 text-right">{i.quantity} × {formatCents(i.unitCents)}<span className="block">{formatCents(i.totalCents)}</span></span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-graphite">Subtotal</dt><dd className="price">{formatCents(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between"><dt className="text-graphite">Cupom {order.couponCode}</dt><dd className="price">− {formatCents(order.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-graphite">Frete</dt><dd className="price">{formatCents(order.shippingCents)}</dd></div>
              <div className="flex justify-between font-medium"><dt>Total</dt><dd className="price">{formatCents(order.totalCents)}</dd></div>
            </dl>
          </Panel>

          <Panel title="Pagamentos">
            {order.payments.length === 0 ? <p className="text-sm text-graphite">Nenhuma tentativa de pagamento.</p> : (
              <ul className="grid gap-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="grid grid-cols-[1fr_auto] gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                    <span>{METHOD[p.method]}{p.installments > 1 ? ` em ${p.installments}x` : ""}{p.cardLastFour ? ` · final ${p.cardLastFour}` : ""}<span className="block text-xs text-graphite">{dt.format(p.createdAt)} · {p.provider} {p.providerPaymentId}{p.statusDetail ? ` · ${p.statusDetail}` : ""}</span></span>
                    <span className="grid justify-items-end"><Pill tone={p.status === "APPROVED" ? "ok" : p.status === "REJECTED" || p.status === "CHARGED_BACK" ? "warn" : "neutral"}>{PAY[p.status]}</Pill><span className="price text-xs">{formatCents(p.amountCents + p.interestCents)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Histórico">
            <ol className="grid gap-2 text-sm">
              {order.statusHistory.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 border-t border-line pt-2 first:border-0 first:pt-0">
                  <span><span className="font-medium">{STATUS_LABEL[e.status]}</span>{e.note && <span className="block text-graphite">{e.note}</span>}</span>
                  <span className="text-xs text-graphite">{dt.format(e.createdAt)} · {actorName(e.actorId)}</span>
                </li>
              ))}
            </ol>
            {emails.length > 0 && (
              <details className="text-sm"><summary className="cursor-pointer text-graphite">E-mails do pedido</summary>
                <ul className="mt-2 grid gap-1">{emails.map((m) => <li key={m.id}>{m.subject} · <span className={m.status === "sent" ? "text-ok" : "text-wine"}>{m.status === "sent" ? "enviado" : m.status === "skipped" ? "não enviado (e-mail não configurado)" : `falhou: ${m.error}`}</span></li>)}</ul>
              </details>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <OrderActions orderId={order.id} next={next.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} fulfillment={order.fulfillment}
            trackingCode={order.shipment?.trackingCode ?? ""} carrier={order.shipment?.carrier ?? order.shipment?.serviceName ?? ""} canRefund={canRefund} />

          <Panel title="Cliente">
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{order.customer.fullName}</p>
              <p className="select-all">{order.customer.email}</p>
              {order.customer.phone && <p className="price">{maskPhone(order.customer.phone)} · <a className="link" href={`https://wa.me/55${order.customer.phone}`} target="_blank" rel="noopener">WhatsApp</a></p>}
              {order.customer.cpf && <p className="price">CPF {maskCPF(order.customer.cpf)}</p>}
              <Link href={`/admin/clientes/${order.customerId}`} className="link mt-2 w-fit">Ver pedidos da cliente</Link>
            </div>
          </Panel>

          <Panel title={order.fulfillment === "PICKUP" ? "Retirada na loja" : "Entrega"}>
            {order.fulfillment === "DELIVERY" ? (
              <div className="grid gap-1 text-sm">
                <p>{order.shipRecipient}</p>
                <p>{order.shipStreet}, {order.shipNumber}{order.shipComplement ? `, ${order.shipComplement}` : ""}</p>
                <p>{order.shipNeighborhood} · {order.shipCity}/{order.shipState}</p>
                <p className="price">CEP {maskCEP(order.shipCep ?? "")}</p>
                {order.shipReference && <p className="text-graphite">Referência: {order.shipReference}</p>}
                {order.shipment && <p className="mt-2 text-graphite">{order.shipment.serviceName}{order.shipment.carrier ? ` · ${order.shipment.carrier}` : ""} · cotado {formatCents(order.shipment.priceCents)}{order.shipment.deliveryDaysMax ? ` · até ${order.shipment.deliveryDaysMax} dias úteis` : ""}</p>}
              </div>
            ) : <p className="text-sm">A cliente retira na loja. Marque “Disponível para retirada” quando separar.</p>}
            {order.customerNote && <p className="border-t border-line pt-3 text-sm"><span className="text-graphite">Observação da cliente:</span> {order.customerNote}</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
