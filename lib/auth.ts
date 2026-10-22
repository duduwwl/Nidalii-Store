import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hash, verify } from "@node-rs/argon2";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { clientIp, userAgent } from "./request";

const SESSION_COOKIE = "nd_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashValue: string, password: string) {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, ip: await clientIp(), userAgent: await userAgent() },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Usuário da sessão atual (memoizado por requisição). */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { customer: true, admin: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export type SignInResult = { ok: true; role: Role } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const generic = "E-mail ou senha incorretos.";
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user?.passwordHash) {
    await hashPassword(password); // tempo constante: não revela se o e-mail existe
    return { ok: false, error: generic };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, error: `Muitas tentativas. Tente de novo em ${LOCK_MINUTES} minutos.` };
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 6e4) : null,
      },
    });
    return { ok: false, error: generic };
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await createSession(user.id);
  return { ok: true, role: user.role };
}

const STAFF_ROLES: Role[] = ["ADMIN", "STAFF"];

/** Use no topo de toda página e ação do painel. A verificação acontece no servidor. */
export async function requireStaff() {
  const user = await currentUser();
  if (!user || !STAFF_ROLES.includes(user.role)) redirect("/admin/entrar");
  return user;
}

export async function requireAdmin() {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/admin?erro=permissao");
  return user;
}

export async function requireCustomer(next = "/minha-conta") {
  const user = await currentUser();
  if (!user) redirect(`/entrar?voltar=${encodeURIComponent(next)}`);
  return user;
}
