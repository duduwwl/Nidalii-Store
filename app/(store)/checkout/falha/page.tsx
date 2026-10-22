import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadOrderFromLink } from "@/server/order-view";
import { orderLink } from "@/lib/order-token";
import { rejectionMessage } from "@/server/payments/mercadopago";

export const metadata: Metadata = { title: "Pagamento não aprovado", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FalhaPage({ searchParams }: Props) {
  const { order } = await loadOrderFromLink(searchParams);
  if (order.paidAt) redirect(orderLink("/checkout/sucesso", order.id));
  const last = order.payments[0];
  const canceled = order.status === "CANCELED";

  return (
    <div className="wrap grid max-w-3xl gap-6 pt-10 lg:pt-16">
      <p className="text-sm text-graphite">Pedido {order.number}</p>
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">{canceled ? "Pedido cancelado" : "O pagamento não foi aprovado"}</h1>
      <p className="max-w-[56ch] text-lg text-graphite">
        {canceled
          ? "O prazo para pagamento terminou e as peças voltaram para o estoque. Você pode montar o carrinho de novo."
          : rejectionMessage(last?.statusDetail ?? undefined)}
      </p>
      <div className="flex flex-wrap gap-3">
        {canceled ? (
          <Link href="/produtos" className="btn btn-solid">Ver produtos</Link>
        ) : (
          <Link href={orderLink("/checkout/pagamento", order.id)} className="btn btn-solid">Tentar outra forma de pagamento</Link>
        )}
        <Link href="/contato" className="btn btn-ghost">Falar com a loja</Link>
      </div>
    </div>
  );
}
