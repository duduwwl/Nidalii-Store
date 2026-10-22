import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import { getCartSummary } from "@/server/cart";
import { cartDiscountAction } from "@/app/actions/cart";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, settings, user, discount] = await Promise.all([getCartSummary(), getSettings(), currentUser(), cartDiscountAction()]);
  if (cart.lines.length === 0) redirect("/carrinho");
  const addresses = user?.customer
    ? await db.address.findMany({ where: { customerId: user.customer.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] })
    : [];

  return (
    <div className="wrap pt-8 lg:pt-12">
      <h1 className="mb-8 font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] lg:mb-12">Finalizar compra</h1>
      <CheckoutForm
        lines={cart.lines.map((l) => ({ id: l.id, name: l.name, colorName: l.colorName, size: l.size, quantity: l.quantity, totalCents: l.totalCents, image: l.image, problem: l.problem }))}
        subtotalCents={cart.subtotalCents}
        discount={discount}
        hasProblems={cart.hasProblems}
        customer={user?.customer ? { fullName: user.customer.fullName, email: user.email, cpf: user.customer.cpf ?? "", phone: user.customer.phone ?? "" } : null}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, cep: a.cep, street: a.street, number: a.number, complement: a.complement, neighborhood: a.neighborhood, city: a.city, state: a.state, reference: a.reference }))}
        shippingConfigured={settings.shippingConfigured}
        pickup={settings.pickupAvailable ? { address: settings.storeAddress!, hours: settings.hours, instructions: settings.pickupInstructions } : null}
      />
    </div>
  );
}
