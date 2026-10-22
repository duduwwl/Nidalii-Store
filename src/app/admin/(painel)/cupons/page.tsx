import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { CouponEditor } from "@/components/admin/simple-editors";

export default async function CuponsPage() {
  const coupons = await db.coupon.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader title="Cupons" description="O desconto é recalculado no servidor a cada compra. O uso só conta quando o pagamento é aprovado." />
      <div className="grid max-w-3xl gap-4">
        <CouponEditor />
        {coupons.map((c) => <CouponEditor key={c.id} coupon={c} />)}
      </div>
    </>
  );
}
