import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { STATUS_LABEL } from "@/server/orders";
import { orderLink } from "@/lib/order-token";
import { OrderSummary } from "./order-summary";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

type Props = {
  order: Parameters<typeof OrderSummary>[0]["order"] & {
    id: string; status: OrderStatus; createdAt: Date; paidAt: Date | null;
    statusHistory: { id: string; status: OrderStatus; createdAt: Date }[];
    shipment: (Parameters<typeof OrderSummary>[0]["order"]["shipment"] & { trackingCode: string | null; carrier: string | null }) | null;
  };
  pickupInfo?: string | null;
};

export function OrderDetail({ order: o, pickupInfo }: Props) {
  const awaiting = o.status === "AWAITING_PAYMENT" || o.status === "PAYMENT_FAILED";
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_minmax(18rem,24rem)] lg:gap-8">
      <div className="grid content-start gap-8">
        <div className="grid gap-2">
          <p className="text-sm text-graphite">Feito em {fmt.format(o.createdAt)}</p>
          <p className="text-lg"><span className="font-medium">{STATUS_LABEL[o.status]}</span></p>
          {awaiting && <Link href={orderLink("/checkout/pagamento", o.id)} className="btn btn-solid mt-2 w-fit">Pagar agora</Link>}
        </div>
        {o.shipment?.trackingCode && (
          <div className="grid gap-1 bg-white p-5">
            <p className="text-sm text-graphite">Código de rastreio{o.shipment.carrier ? ` · ${o.shipment.carrier}` : ""}</p>
            <p className="price select-all text-lg">{o.shipment.trackingCode}</p>
            <a href={`https://www.linkcorreios.com.br/?id=${encodeURIComponent(o.shipment.trackingCode)}`} target="_blank" rel="noopener" className="link w-fit text-sm">Rastrear entrega</a>
          </div>
        )}
        {o.fulfillment === "PICKUP" && pickupInfo && <p className="bg-white p-5 text-[0.9375rem]">{pickupInfo}</p>}
        <div>
          <h2 className="mb-4 font-display text-xl">Histórico</h2>
          <ol className="grid gap-3 border-l border-line pl-5">
            {o.statusHistory.map((e) => (
              <li key={e.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[1.4rem] top-2 size-2 rounded-full bg-ink" />
                <p>{STATUS_LABEL[e.status]}</p>
                <p className="text-sm text-graphite">{fmt.format(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <OrderSummary order={o} />
    </div>
  );
}
