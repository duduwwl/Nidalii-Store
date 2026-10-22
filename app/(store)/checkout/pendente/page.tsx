import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadOrderFromLink } from "@/server/order-view";
import { orderLink } from "@/lib/order-token";
import { formatCents } from "@/lib/money";
import { PixPanel } from "@/components/store/pix-panel";
import { OrderSummary } from "@/components/store/order-summary";
import { StatusWatcher } from "@/components/store/status-watcher";

export const metadata: Metadata = { title: "Aguardando pagamento", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PendentePage({ searchParams }: Props) {
  const { order, token } = await loadOrderFromLink(searchParams);
  if (order.paidAt) redirect(orderLink("/checkout/sucesso", order.id));
  if (order.status === "PAYMENT_FAILED" || order.status === "CANCELED") redirect(orderLink("/checkout/falha", order.id));
  const pix = order.payments.find((p) => p.method === "PIX" && p.status === "PENDING");
  const card = order.payments.find((p) => p.method !== "PIX" && p.status === "PENDING");

  return (
    <div className="wrap grid gap-12 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-12">
      <div className="grid content-start gap-8 lg:col-span-7">
        <div className="grid gap-3">
          <p className="text-sm text-graphite">Pedido {order.number}</p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">{pix ? "Pague com Pix" : "Pagamento em análise"}</h1>
        </div>
        {pix?.pixQrCode ? (
          <PixPanel code={pix.pixQrCode} qrBase64={pix.pixQrCodeBase64} amount={formatCents(order.totalCents)} expiresAt={pix.pixExpiresAt?.toISOString() ?? null} retryUrl={orderLink("/checkout/pagamento", order.id)} />
        ) : card ? (
          <p className="max-w-[56ch] text-lg text-graphite">O banco está analisando o pagamento. Isso costuma levar alguns minutos. Esta página atualiza sozinha, e você também recebe a confirmação por e-mail.</p>
        ) : (
          <p className="text-graphite">Nenhum pagamento em aberto. <a href={orderLink("/checkout/pagamento", order.id)} className="link">Escolher forma de pagamento</a></p>
        )}
        <StatusWatcher orderId={order.id} token={token} successUrl={orderLink("/checkout/sucesso", order.id)} failureUrl={orderLink("/checkout/falha", order.id)} />
      </div>
      <aside className="lg:col-span-4 lg:col-start-9"><OrderSummary order={order} /></aside>
    </div>
  );
}
