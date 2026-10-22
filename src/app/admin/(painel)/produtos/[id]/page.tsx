import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Pill } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { ImageManager } from "@/components/admin/image-manager";
import { VariantManager } from "@/components/admin/variant-manager";
import { ProductDanger } from "@/components/admin/product-danger";

export default async function EditProdutoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ novo?: string }> }) {
  const { id } = await params;
  const isNew = (await searchParams).novo === "1";
  const [p, categories, collections] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: [{ colorName: "asc" }, { size: "asc" }] },
        collections: { select: { collectionId: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!p) notFound();
  const colors = [...new Set(p.variants.map((v) => v.colorName).filter(Boolean) as string[])];

  return (
    <>
      <PageHeader
        title={p.name}
        back={{ href: "/admin/produtos", label: "Produtos" }}
        actions={
          <>
            {p.status === "ACTIVE" ? <Pill tone="ok">Na loja</Pill> : p.status === "DRAFT" ? <Pill>Rascunho</Pill> : <Pill tone="warn">Arquivado</Pill>}
            {p.status === "ACTIVE" && <Link href={`/produtos/${p.slug}`} target="_blank" className="btn btn-ghost btn-sm">Ver na loja</Link>}
          </>
        }
      />
      {isNew && <p className="mb-6 border border-ink bg-white p-4">Produto criado como rascunho. Agora envie as fotos e crie as variantes; depois mude a situação para “Na loja”.</p>}
      <div className="grid gap-6 2xl:grid-cols-[1fr_1fr]">
        <div className="grid content-start gap-6">
          <ImageManager productId={p.id} images={p.images} colors={colors} />
          <VariantManager productId={p.id} variants={p.variants} basePriceCents={p.priceCents} />
        </div>
        <ProductForm
          categories={categories}
          collections={collections}
          product={{ ...p, collectionIds: p.collections.map((c) => c.collectionId) }}
        />
      </div>
      <ProductDanger productId={p.id} archived={p.status === "ARCHIVED"} />
    </>
  );
}
