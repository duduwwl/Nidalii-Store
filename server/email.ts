import "server-only";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { orderLink } from "@/lib/order-token";
import { STATUS_LABEL } from "./orders";
import { getSettings } from "./settings";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Envia pelo Resend quando RESEND_API_KEY e EMAIL_FROM estão configurados.
 * Sem configuração, registra como "skipped" para o painel mostrar o que faltou.
 */
async function send(p: { to: string; subject: string; html: string; template: string; orderId?: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    await db.emailLog.create({ data: { to: p.to, subject: p.subject, template: p.template, orderId: p.orderId, status: "skipped", error: "E-mail não configurado" } });
    if (process.env.NODE_ENV !== "production") console.info(`[e-mail não enviado] ${p.subject} → ${p.to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [p.to], subject: p.subject, html: p.html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    await db.emailLog.create({ data: { to: p.to, subject: p.subject, template: p.template, orderId: p.orderId, status: "sent" } });
    return true;
  } catch (e) {
    await db.emailLog.create({ data: { to: p.to, subject: p.subject, template: p.template, orderId: p.orderId, status: "failed", error: String(e).slice(0, 400) } });
    return false;
  }
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8f7f5;font-family:Helvetica,Arial,sans-serif;color:#0a0a0a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f5"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff">
<tr><td style="padding:28px 32px;border-bottom:1px solid #dddad5;font-family:Georgia,serif;font-size:22px;letter-spacing:4px">NIDALII <span style="font-style:italic;font-size:15px;color:#55524e;letter-spacing:0">store</span></td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.15">${title}</h1>${body}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${href}" style="background:#0a0a0a;color:#ffffff;text-decoration:none;padding:14px 24px;display:inline-block;font-size:15px">${label}</a></p>`;

async function orderWithItems(orderId: string) {
  return db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, customer: true, shipment: true } });
}

function itemsTable(o: Awaited<ReturnType<typeof orderWithItems>>) {
  const rows = o.items
    .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #efede9">${esc(i.productName)}<br><span style="color:#55524e;font-size:13px">${esc([i.colorName, i.size, `${i.quantity} un.`].filter(Boolean).join(" · "))}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #efede9">${formatCents(i.totalCents)}</td></tr>`)
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}
<tr><td style="padding:12px 0 0;color:#55524e">Frete</td><td align="right" style="padding:12px 0 0">${o.shippingCents ? formatCents(o.shippingCents) : "Grátis"}</td></tr>
${o.discountCents ? `<tr><td style="color:#55524e">Desconto</td><td align="right">− ${formatCents(o.discountCents)}</td></tr>` : ""}
<tr><td style="padding-top:8px;font-weight:bold">Total</td><td align="right" style="padding-top:8px;font-weight:bold">${formatCents(o.totalCents)}</td></tr></table>`;
}

export async function sendOrderPaid(orderId: string) {
  const o = await orderWithItems(orderId);
  const s = await getSettings();
  const next = o.fulfillment === "PICKUP"
    ? `<p>Vamos separar as peças e avisar quando estiverem prontas para retirada${s.storeAddress ? ` em ${esc(s.storeAddress)}` : ""}.</p>`
    : `<p>Quando o pedido for postado, enviamos o código de rastreio.</p>`;
  await send({
    to: o.customer.email, template: "order_paid", orderId,
    subject: `Pedido ${o.number} confirmado`,
    html: layout(`Pagamento aprovado`, `<p>Olá, ${esc(o.customer.fullName.split(" ")[0])}. Recebemos o pagamento do pedido ${o.number}.</p>${next}${itemsTable(o)}${button(`${siteUrl()}${orderLink("/pedido", o.id)}`, "Acompanhar pedido")}`),
  });
}

export async function sendOrderStatus(orderId: string) {
  const o = await orderWithItems(orderId);
  const s = await getSettings();
  let extra = "";
  if (o.status === "SHIPPED" && o.shipment?.trackingCode) extra = `<p>Código de rastreio: <strong>${esc(o.shipment.trackingCode)}</strong>${o.shipment.carrier ? ` (${esc(o.shipment.carrier)})` : ""}.</p>`;
  if (o.status === "READY_FOR_PICKUP") extra = `<p>Suas peças estão separadas.${s.storeAddress ? ` Endereço: ${esc(s.storeAddress)}.` : ""}</p>${s.hours.length ? `<p>${s.hours.map((h) => `${esc(h.days)}: ${h.open} às ${h.close}`).join("<br>")}</p>` : ""}<p>${esc(s.pickupInstructions ?? "Leve um documento com foto.")}</p>`;
  await send({
    to: o.customer.email, template: `order_${o.status.toLowerCase()}`, orderId,
    subject: `Pedido ${o.number}: ${STATUS_LABEL[o.status].toLowerCase()}`,
    html: layout(STATUS_LABEL[o.status], `<p>Olá, ${esc(o.customer.fullName.split(" ")[0])}. O pedido ${o.number} mudou de situação.</p>${extra}${button(`${siteUrl()}${orderLink("/pedido", o.id)}`, "Ver pedido")}`),
  });
}

export async function sendPasswordReset(to: string, link: string) {
  await send({
    to, template: "password_reset", subject: "Redefinir sua senha",
    html: layout("Redefinir senha", `<p>Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora.</p>${button(link, "Criar nova senha")}<p style="color:#55524e;font-size:13px">Se não foi você, ignore este e-mail. Sua senha continua a mesma.</p>`),
  });
}
