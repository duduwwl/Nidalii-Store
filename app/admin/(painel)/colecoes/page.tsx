import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { CollectionEditor } from "@/components/admin/simple-editors";

export default async function ColecoesAdminPage() {
  const collections = await db.collection.findMany({ orderBy: [{ position: "asc" }, { createdAt: "desc" }], include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title="Coleções" description="Coleções marcadas como destaque aparecem na página inicial. Coleções sem produtos à venda não aparecem na loja." />
      <div className="grid max-w-3xl gap-4">
        <CollectionEditor />
        {collections.map((c) => <CollectionEditor key={c.id} collection={c} count={c._count.products} />)}
      </div>
    </>
  );
}
