import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { CartView } from "@/components/store/cart-view";
import { cartDiscountAction } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function CarrinhoPage() {
  const [settings, discount] = await Promise.all([getSettings(), cartDiscountAction()]);
  return (
    <div className="wrap pt-8 lg:pt-14">
      <h1 className="mb-10 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.95]">Carrinho</h1>
      <CartView shippingConfigured={settings.shippingConfigured} pickupAvailable={settings.pickupAvailable} initialDiscount={discount} />
    </div>
  );
}
