import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { availableStock } from "./catalog";

const CART_COOKIE = "nd_cart";
const MAX_QTY_PER_LINE = 10;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            select: {
              id: true, name: true, slug: true, status: true, priceCents: true, compareAtCents: true, publishedAt: true,
              weightGrams: true, lengthCm: true, widthCm: true, heightCm: true,
              images: { orderBy: { position: "asc" }, select: { url: true, alt: true, colorName: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Lê o carrinho atual sem criar nada (seguro em Server Components). */
export async function readCart(): Promise<CartWithItems | null> {
  const user = await currentUser();
  if (user?.customer) {
    const c = await db.cart.findFirst({ where: { customerId: user.customer.id }, include: cartInclude, orderBy: { updatedAt: "desc" } });
    if (c) return c;
  }
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return null;
  return db.cart.findUnique({ where: { tokenHash: sha256(token) }, include: cartInclude });
}

/** Busca ou cria o carrinho. Só pode ser chamada em Server Actions / Route Handlers. */
export async function ensureCart(): Promise<CartWithItems> {
  const existing = await readCart();
  if (existing) return existing;
  const user = await currentUser();
  const token = randomBytes(24).toString("base64url");
  const cart = await db.cart.create({
    data: {
      tokenHash: sha256(token),
      customerId: user?.customer?.id ?? null,
      expiresAt: new Date(Date.now() + 60 * 864e5),
    },
    include: cartInclude,
  });
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 86400,
  });
  return cart;
}

/** Ao entrar na conta, junta o carrinho de visitante ao da cliente. */
export async function mergeGuestCart(customerId: string) {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return;
  const guest = await db.cart.findUnique({ where: { tokenHash: sha256(token) }, include: { items: true } });
  if (!guest || guest.customerId === customerId) return;
  const own = await db.cart.findFirst({ where: { customerId }, include: { items: true } });
  if (!own) {
    await db.cart.update({ where: { id: guest.id }, data: { customerId } });
    return;
  }
  for (const item of guest.items) {
    const match = own.items.find((i) => i.variantId === item.variantId);
    const quantity = Math.min(MAX_QTY_PER_LINE, (match?.quantity ?? 0) + item.quantity);
    await db.cartItem.upsert({
      where: { cartId_variantId: { cartId: own.id, variantId: item.variantId } },
      update: { quantity },
      create: { cartId: own.id, variantId: item.variantId, quantity },
    });
  }
  await db.cart.delete({ where: { id: guest.id } });
}

export type CartError = { ok: false; error: string };
export type CartOk = { ok: true };

export async function addToCart(variantId: string, quantity: number): Promise<CartOk | CartError> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) return { ok: false, error: "Quantidade inválida." };
  const variant = await db.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE" || variant.product.priceCents == null) {
    return { ok: false, error: "Este produto não está disponível." };
  }
  const cart = await ensureCart();
  const current = cart.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  const wanted = current + quantity;
  const free = availableStock(variant);
  if (free <= 0) return { ok: false, error: "Esta combinação de cor e tamanho esgotou." };
  if (wanted > free) return { ok: false, error: `Só ${free === 1 ? "resta 1 unidade" : `restam ${free} unidades`} ${free === 1 ? "disponível" : "disponíveis"}.` };
  if (wanted > MAX_QTY_PER_LINE) return { ok: false, error: `O limite é de ${MAX_QTY_PER_LINE} unidades por peça.` };
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId } },
    update: { quantity: wanted },
    create: { cartId: cart.id, variantId, quantity },
  });
  return { ok: true };
}

export async function setCartQuantity(itemId: string, quantity: number): Promise<CartOk | CartError> {
  const cart = await readCart();
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) return { ok: false, error: "Item não encontrado no carrinho." };
  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id: itemId } });
    return { ok: true };
  }
  const free = availableStock(item.variant);
  if (quantity > Math.min(free, MAX_QTY_PER_LINE)) {
    return { ok: false, error: free > 0 ? `Disponível: ${Math.min(free, MAX_QTY_PER_LINE)}.` : "Esta peça esgotou." };
  }
  await db.cartItem.update({ where: { id: itemId }, data: { quantity } });
  return { ok: true };
}

export async function setCartCoupon(code: string | null) {
  const cart = await ensureCart();
  await db.cart.update({ where: { id: cart.id }, data: { couponCode: code ? code.toUpperCase() : null } });
}

export function unitPrice(v: { priceCents: number | null; product: { priceCents: number | null } }) {
  return v.priceCents ?? v.product.priceCents ?? 0;
}

export type CartLine = {
  id: string;
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  sku: string;
  colorName: string | null;
  size: string | null;
  image: { url: string; alt: string } | null;
  quantity: number;
  unitCents: number;
  compareAtCents: number | null;
  totalCents: number;
  available: number;
  problem: string | null; // indisponível, estoque menor que o pedido...
  weightGrams: number | null;
  dims: { l: number | null; w: number | null; h: number | null };
};

/** Calcula as linhas e o subtotal sempre a partir do banco. */
export function summarizeCart(cart: CartWithItems | null) {
  const lines: CartLine[] = (cart?.items ?? []).map((item) => {
    const v = item.variant;
    const p = v.product;
    const free = availableStock(v);
    const live = v.isActive && p.status === "ACTIVE" && p.priceCents != null;
    const image = p.images.find((i) => i.colorName && i.colorName === v.colorName) ?? p.images[0] ?? null;
    const unit = unitPrice(v);
    return {
      id: item.id,
      variantId: v.id,
      productId: p.id,
      name: p.name,
      slug: p.slug,
      sku: v.sku,
      colorName: v.colorName,
      size: v.size,
      image: image ? { url: image.url, alt: image.alt } : null,
      quantity: item.quantity,
      unitCents: unit,
      compareAtCents: p.compareAtCents,
      totalCents: unit * item.quantity,
      available: free,
      problem: !live ? "Indisponível" : free === 0 ? "Esgotado" : item.quantity > free ? (free === 1 ? "Só 1 disponível" : `Só ${free} disponíveis`) : null,
      weightGrams: v.weightGrams ?? p.weightGrams,
      dims: { l: p.lengthCm, w: p.widthCm, h: p.heightCm },
    };
  });
  const valid = lines.filter((l) => !l.problem);
  return {
    cartId: cart?.id ?? null,
    couponCode: cart?.couponCode ?? null,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents: valid.reduce((n, l) => n + l.totalCents, 0),
    hasProblems: lines.some((l) => l.problem),
  };
}

export type CartSummary = ReturnType<typeof summarizeCart>;

export async function getCartSummary() {
  return summarizeCart(await readCart());
}
