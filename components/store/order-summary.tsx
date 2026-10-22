import { formatCents } from "@/lib/money";

type O = {
  number: number;
  fulfillment: "DELIVERY" | "PICKUP";
  subtotalCents: number; discountCents: number; shippingCents: number; totalCents: number; couponCode: string | null;
  shipStreet: string | null; shipNumber: string | null; shipComplement: string | null; shipNeighborhood: string | null; shipCity: string | null; shipState: string | null; shipCep: string | null;
  items: { id: string; productName: string; colorName: string | null; size: string | null; quantity: number; totalCents: number }[];
  shipment: { serviceName: string; deliveryDaysMin: number | null; deliveryDaysMax: number | null } | null;
};

export function OrderSummary({ order: o }: { order: O }) {
  return (
    <div className="grid gap-5 bg-white p-6 lg:p-8">
      <h2 className="font-display text-[1.75rem]">Resumo</h2>
      <ul className="grid gap-3 text-sm">
        {o.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4">
            <span><span className="font-medium">{i.productName}</span><span className="block text-graphite">{[i.colorName, i.size, `${i.quantity} un.`].filter(Boolean).join(" · ")}</span></span>
            <span className="price">{formatCents(i.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-2 border-t border-line pt-4 text-[0.9375rem]">
        <div className="flex justify-between"><dt className="text-graphite">Subtotal</dt><dd className="price">{formatCents(o.subtotalCents)}</dd></div>
        {o.discountCents > 0 && <div className="flex justify-between"><dt className="text-graphite">Desconto{o.couponCode ? ` (${o.couponCode})` : ""}</dt><dd className="price">− {formatCents(o.discountCents)}</dd></div>}
        <div className="flex justify-between"><dt className="text-graphite">{o.fulfillment === "PICKUP" ? "Retirada" : "Frete"}</dt><dd className="price">{o.shippingCents === 0 ? "Grátis" : formatCents(o.shippingCents)}</dd></div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-4"><dt className="font-medium">Total</dt><dd className="price text-xl">{formatCents(o.totalCents)}</dd></div>
      </dl>
      <div className="grid gap-1 border-t border-line pt-4 text-sm">
        <p className="text-graphite">{o.fulfillment === "PICKUP" ? "Retirada na loja" : "Entrega"}</p>
        {o.fulfillment === "DELIVERY" && (
          <>
            <p>{o.shipStreet}, {o.shipNumber}{o.shipComplement ? `, ${o.shipComplement}` : ""}</p>
            <p>{o.shipNeighborhood} · {o.shipCity}/{o.shipState} · {o.shipCep?.replace(/(\d{5})(\d{3})/, "$1-$2")}</p>
            {o.shipment && <p className="text-graphite">{o.shipment.serviceName}{o.shipment.deliveryDaysMax ? ` · até ${o.shipment.deliveryDaysMax} dias úteis` : ""}</p>}
          </>
        )}
      </div>
    </div>
  );
}
