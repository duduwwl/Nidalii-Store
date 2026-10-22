import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";

export default async function NovoProdutoPage() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Novo produto" description="Depois de salvar, você envia as fotos e cria as variantes de cor e tamanho." back={{ href: "/admin/produtos", label: "Produtos" }} />
      <ProductForm categories={categories} collections={collections} />
    </>
  );
}
