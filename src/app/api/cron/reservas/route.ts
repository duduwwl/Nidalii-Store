import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { expireStaleReservations } from "@/server/orders";

/**
 * Libera o estoque de pedidos que não foram pagos no prazo.
 * Chame a cada 5–10 minutos (cron da hospedagem) com o cabeçalho Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const released = await expireStaleReservations();
  return NextResponse.json({ ok: true, released });
}
