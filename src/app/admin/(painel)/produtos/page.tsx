import Image from "next/image";
import Link from "next/link";
import type { Prisma, ProductStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { Empty, PageHeader, Pill, Table } from "@/components/admin/ui";

const STATUS: Record<ProductStatus, { label: string; tone: "neutral" | "ok" | "warn" }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  ACTIVE: { label: "Na loja", tone: "ok" },
  ARCHIVED: { label: "Arquivado", tone: "warn" },
};

export default async function AdminProdutosPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; categoria?: string }> }) {
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } }] } : {}),
    ...(sp.status && sp.status in STATUS ? { status: sp.status as ProductStatus } : { status: { not: "ARCHIVED" } }),
    ...(sp.categoria ? { categoryId: sp.categoria } : {}),
  };
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where, orderBy: { updatedAt: "desc" }, take: 200,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, category: true, variants: { select: { stock: true, reserved: true, isActive: true } }, _count: { select: { images: { where: { needsBetterPhoto: true } } } } },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Produtos" actions={<Link href="/admin/produtos/novo" className="btn btn-solid">Novo produto</Link>} />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar por nome ou SKU</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Nome ou SKU…" className="input max-w-xs" />
        <label htmlFor="status" className="sr-only">Situação</label>
        <select id="status" name="status" defaultValue={sp.status ?? ""} className="select w-auto">
          <option value="">Rascunhos e na loja</option>
          <option value="ACTIVE">Na loja</option><option value="DRAFT">Rascunhos</option><option value="ARCHIVED">Arquivados</option>
        </select>
        <label htmlFor="categoria" className="sr-only">Categoria</label>
        <select id="categoria" name="categoria" defaultValue={sp.categoria ?? ""} className="select w-auto">
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn btn-ghost">Filtrar</button>
      </form>

      {products.length === 0 ? (
        <Empty>
          <p>{sp.q || sp.status ? "Nenhum produto com esses filtros." : "Nenhum produto cadastrado ainda."}</p>
          <Link href="/admin/produtos/novo" className="btn btn-solid">Cadastrar o primeiro produto</Link>
        </Empty>
      ) : (
        <Table>
          <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Situação</th></tr></thead>
          <tbody>
            {products.map((p) => {
              const free = p.variants.filter((v) => v.isActive).reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/produtos/${p.id}`} className="flex items-center gap-3">
                      <span className="photo block w-12 shrink-0">{p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="48px" />}</span>
                      <span className="grid"><span className="font-medium">{p.name}</span>{p._count.images > 0 && <span className="text-xs text-wine">foto precisa ser refeita</span>}</span>
                    </Link>
                  </td>
                  <td>{p.category?.name ?? <span className="text-graphite">—</span>}</td>
                  <td className="price">{p.priceCents != null ? formatCents(p.priceCents) : <span className="text-wine">sem preço</span>}</td>
                  <td className="price">{p.variants.length ? `${free} un. · ${p.variants.length} var.` : <span className="text-wine">sem variantes</span>}</td>
                  <td><Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill>{p.isFeatured && <span className="ml-2 text-xs text-graphite">destaque</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
