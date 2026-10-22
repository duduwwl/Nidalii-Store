import type { Metadata } from "next";
import { db } from "@/lib/db";
import { loadOrderFromLink } from "@/server/order-view";
import { getSettings } from "@/server/settings";
import { OrderDetail } from "@/components/store/order-detail";

export const metadata: Metadata = { title: "Acompanhar pedido", robots: { index: false } };

/** Acompanhamento pelo link do e-mail, sem precisar de conta. */
export default async function PedidoPublicoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { order } = await loadOrderFromLink(searchParams);
  const history = await db.orderStatusEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
  const s = await getSettings();
  return (
    <div className="wrap grid gap-6 pt-8 lg:pt-14">
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95]">Pedido {order.number}</h1>
      <OrderDetail order={{ ...order, statusHistory: history }} pickupInfo={s.storeAddress ? `Retirada em ${s.storeAddress}. ${s.pickupInstructions ?? "Leve um documento com foto."}` : null} />
    </div>
  );
}
