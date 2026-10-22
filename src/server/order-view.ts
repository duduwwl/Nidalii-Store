import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifyOrderToken } from "@/lib/order-token";

/** Carrega um pedido a partir do link assinado (?pedido=&t=). */
export async function loadOrderFromLink(sp: Promise<Record<string, string | string[] | undefined>>) {
  const p = await sp;
  const id = typeof p.pedido === "string" ? p.pedido : null;
  const t = typeof p.t === "string" ? p.t : null;
  if (!id || !verifyOrderToken(id, t)) notFound();
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      customer: { select: { fullName: true, email: true } },
      payments: { orderBy: { createdAt: "desc" } },
      shipment: true,
    },
  });
  if (!order) notFound();
  return { order, token: t! };
}
