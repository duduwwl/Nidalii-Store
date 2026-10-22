import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { CategoryEditor } from "@/components/admin/simple-editors";

export default async function CategoriasPage() {
  const categories = await db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  return (
    <>
      <PageHeader title="Categorias" description="A loja mostra só categorias que têm produtos à venda." />
      <div className="grid max-w-3xl gap-4">
        <CategoryEditor />
        {categories.map((c) => <CategoryEditor key={c.id} category={c} count={c._count.products} />)}
      </div>
    </>
  );
}
