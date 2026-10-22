import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPayment, verifyWebhookSignature } from "@/server/payments/mercadopago";
import { syncFromProvider } from "@/server/payments";

/**
 * Notificações do Mercado Pago.
 * 1. Valida a assinatura. 2. Registra o evento uma única vez.
 * 3. Busca o pagamento na API (nunca confia no corpo da notificação). 4. Atualiza o pedido.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook não configurado" }, { status: 503 });

  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { id?: number | string; type?: string; action?: string; data?: { id?: string } } | null;
  const dataId = url.searchParams.get("data.id") ?? body?.data?.id?.toString() ?? null;
  const type = url.searchParams.get("type") ?? body?.type ?? "unknown";

  const valid = verifyWebhookSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret,
    toleranceSeconds: 600,
  });

  const eventId = String(body?.id ?? `${type}:${dataId}:${req.headers.get("x-request-id") ?? ""}`);
  let event;
  try {
    event = await db.paymentEvent.create({
      data: {
        provider: "mercadopago",
        providerEventId: eventId,
        type: `${type}${body?.action ? `:${body.action}` : ""}`,
        signatureValid: valid,
        payload: (body ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if ((e as Prisma.PrismaClientKnownRequestError).code !== "P2002") throw e;
    const existing = await db.paymentEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: "mercadopago", providerEventId: eventId } },
    });
    // já processado: responde 200 para o provedor parar de reenviar
    if (existing.processedAt) return NextResponse.json({ ok: true, duplicate: true });
    event = existing; // tentativa anterior falhou: processa de novo
  }

  if (!valid) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  if (type !== "payment" || !dataId) {
    await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const mp = await getPayment(dataId);
    const payment = await syncFromProvider(mp);
    await db.paymentEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), paymentId: payment?.id ?? null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await db.paymentEvent.update({ where: { id: event.id }, data: { error: String(e).slice(0, 500) } });
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
