import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadOrderFromLink } from "@/server/order-view";
import { orderLink } from "@/lib/order-token";
import { getSettings } from "@/server/settings";
import { mpConfigured } from "@/server/payments/mercadopago";
import { formatCents } from "@/lib/money";
import { PaymentChooser } from "@/components/store/payment-chooser";
import { OrderSummary } from "@/components/store/order-summary";

export const metadata: Metadata = { title: "Pagamento", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PagamentoPage({ searchParams }: Props) {
  const { order, token } = await loadOrderFromLink(searchParams);
  if (order.paidAt) redirect(orderLink("/checkout/sucesso", order.id));
  if (order.status === "CANCELED") redirect(orderLink("/checkout/falha", order.id));
  const openPix = order.payments.find((p) => p.method === "PIX" && p.status === "PENDING" && p.pixExpiresAt && p.pixExpiresAt > new Date());
  if (openPix) redirect(orderLink("/checkout/pendente", order.id));
  const settings = await getSettings();
  const configured = mpConfigured();
  const lastFailure = order.status === "PAYMENT_FAILED";

  return (
    <div className="wrap grid gap-12 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-12">
      <div className="grid content-start gap-8 lg:col-span-7">
        <div className="grid gap-3">
          <p className="text-sm text-graphite">Pedido {order.number}</p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">Pagamento</h1>
          <p className="price text-lg">Total {formatCents(order.totalCents)}</p>
        </div>
        {lastFailure && <p className="border border-wine bg-white p-4 text-wine" role="alert">O último pagamento não foi aprovado. Tente outra forma de pagamento.</p>}
        {configured ? (
          <PaymentChooser
            orderId={order.id}
            token={token}
            amountCents={order.totalCents}
            email={order.customer.email}
            publicKey={process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!}
            maxInstallments={settings.maxInstallments}
            pixMinutes={settings.pixExpirationMinutes}
          />
        ) : (
          <div className="grid gap-3 border border-line bg-white p-6">
            <p className="font-medium">O pagamento online ainda não foi ativado pela loja.</p>
            <p className="text-graphite">Seu pedido foi registrado e as peças ficam reservadas por um tempo. Fale com a loja para concluir o pagamento.</p>
          </div>
        )}
      </div>
      <aside className="lg:col-span-4 lg:col-start-9"><OrderSummary order={order} /></aside>
    </div>
  );
}
