import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminSignOutAction } from "../actions/auth";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const pending = await db.order.count({ where: { status: { in: ["PAID", "PREPARING", "READY_FOR_PICKUP"] } } });
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[15rem_1fr]">
      <AdminNav role={user.role} name={user.admin?.displayName ?? user.email} pendingOrders={pending} signOut={adminSignOutAction} />
      <main id="conteudo" className="min-w-0 px-4 pb-24 pt-6 lg:px-10 lg:pt-10">{children}</main>
    </div>
  );
}
