"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

const ids = z.array(z.string().min(1).max(40)).max(200);

async function wishlistFor() {
  const user = await currentUser();
  if (!user?.customer) return null;
  return db.wishlist.upsert({ where: { customerId: user.customer.id }, update: {}, create: { customerId: user.customer.id } });
}

/** Alterna o favorito na conta. Para visitantes, o navegador guarda localmente. */
export async function toggleFavoriteAction(productId: string): Promise<{ ok: boolean; favorited: boolean }> {
  const wl = await wishlistFor();
  if (!wl) return { ok: false, favorited: false };
  const pid = z.string().min(1).max(40).parse(productId);
  const exists = await db.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId: wl.id, productId: pid } } });
  if (exists) {
    await db.wishlistItem.delete({ where: { wishlistId_productId: { wishlistId: wl.id, productId: pid } } });
    return { ok: true, favorited: false };
  }
  const product = await db.product.findUnique({ where: { id: pid }, select: { id: true } });
  if (!product) return { ok: false, favorited: false };
  await db.wishlistItem.create({ data: { wishlistId: wl.id, productId: pid } });
  return { ok: true, favorited: true };
}

/** Ao entrar, os favoritos guardados no navegador passam para a conta. */
export async function mergeFavoritesAction(productIds: string[]): Promise<string[]> {
  const wl = await wishlistFor();
  if (!wl) return [];
  const list = ids.parse(productIds);
  const existing = await db.product.findMany({ where: { id: { in: list } }, select: { id: true } });
  await db.wishlistItem.createMany({ data: existing.map((p) => ({ wishlistId: wl.id, productId: p.id })), skipDuplicates: true });
  const all = await db.wishlistItem.findMany({ where: { wishlistId: wl.id }, select: { productId: true } });
  return all.map((i) => i.productId);
}
