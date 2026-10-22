"use server";

import { redirect } from "next/navigation";
import { destroySession, signIn } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

export async function adminSignInAction(_: unknown, form: FormData) {
  const ip = await clientIp();
  if (!(await rateLimit(`admin-login:${ip}`, 8, 900))) return { error: "Muitas tentativas. Tente de novo em 15 minutos." };
  const email = String(form.get("email") ?? "");
  const res = await signIn(email, String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  if (res.role !== "ADMIN" && res.role !== "STAFF") {
    await destroySession();
    return { error: "Esta conta não tem acesso ao painel." };
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  await audit({ actorId: user?.id ?? null, action: "auth.login", entityType: "User", entityId: user?.id });
  redirect("/admin");
}

export async function adminSignOutAction() {
  await destroySession();
  redirect("/admin/entrar");
}
