import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadOrderFromLink } from "@/server/order-view";
import { orderLink } from "@/lib/order-token";
import { getSettings } from "@/server/settings";
import { STATUS_LABEL } from "@/server/orders";
import { OrderSummary } from "@/components/store/order-summary";

export const metadata: Metadata = { title: "Pedido confirmado", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SucessoPage({ searchParams }: Props) {
  const { order } = await loadOrderFromLink(searchParams);
  // A página só confirma o que o provedor confirmou: sem pagamento aprovado, volta para a espera
  if (!order.paidAt) redirect(orderLink("/checkout/pendente", order.id));
  const s = await getSettings();
  const firstName = order.customer.fullName.split(" ")[0];

  return (
    <div className="wrap grid gap-12 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-16">
      <div className="grid content-start gap-6 lg:col-span-7">
        <span className="n-dot !size-14 !text-xl font-display" aria-hidden="true">N</span>
        <h1 className="font-display text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">Obrigada, {firstName}.</h1>
        <p className="max-w-[52ch] text-lg text-graphite">
          O pagamento do pedido {order.number} foi aprovado. Enviamos a confirmação para {order.customer.email}.
        </p>
        <div className="grid gap-2 bg-white p-6">
          <p className="text-sm text-graphite">Situação</p>
          <p className="font-medium">{STATUS_LABEL[order.status]}</p>
          {order.fulfillment === "PICKUP" ? (
            <p className="text-graphite">Vamos separar suas peças e avisar por e-mail quando estiverem prontas para retirada{s.storeAddress ? ` em ${s.storeAddress}` : ""}. Leve um documento com foto.</p>
          ) : (
            <p className="text-graphite">Quando o pedido for postado, você recebe o código de rastreio por e-mail.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={orderLink("/pedido", order.id)} className="btn btn-solid">Acompanhar pedido</Link>
          <Link href="/produtos" className="btn btn-ghost">Continuar comprando</Link>
        </div>
      </div>
      <aside className="lg:col-span-4 lg:col-start-9"><OrderSummary order={order} /></aside>
    </div>
  );
}
