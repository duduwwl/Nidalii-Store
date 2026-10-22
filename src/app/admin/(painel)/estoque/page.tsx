import Link from "next/link";
import { db } from "@/lib/db";
import { Empty, PageHeader, Table } from "@/components/admin/ui";
import { StockAdjust } from "@/components/admin/stock-adjust";

const REASON = { RESTOCK: "Entrada", ADJUSTMENT: "Ajuste", SALE: "Venda", RESERVATION: "Reserva", RELEASE: "Reserva liberada", CANCELLATION: "Cancelamento", RETURN: "Devolução" } as const;
const dt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string }> }) {
  const sp = await searchParams;
  const variants = await db.productVariant.findMany({
    where: {
      product: { status: { not: "ARCHIVED" } },
      ...(sp.q ? { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { name: { contains: sp.q, mode: "insensitive" } } }] } : {}),
    },
    include: { product: { select: { id: true, name: true } } },
    orderBy: [{ product: { name: "asc" } }, { colorName: "asc" }, { size: "asc" }],
    take: 500,
  });
  const rows = variants
    .map((v) => ({ ...v, free: v.stock - v.reserved }))
    .filter((v) => (sp.filtro === "baixo" ? v.isActive && v.free <= v.lowStockAt : sp.filtro === "esgotado" ? v.free <= 0 : true));
  const movements = await db.inventoryMovement.findMany({
    where: { reason: { not: "RESERVATION" } }, orderBy: { createdAt: "desc" }, take: 30,
    include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
  });

  return (
    <>
      <PageHeader title="Estoque" description="O disponível é o estoque menos o que está reservado em pedidos aguardando pagamento." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[["", "Todas"], ["baixo", "Estoque baixo"], ["esgotado", "Esgotadas"]].map(([v, l]) => (
          <Link key={v} href={`/admin/estoque${v ? `?filtro=${v}` : ""}`} className={`btn btn-sm ${sp.filtro === v || (!sp.filtro && !v) ? "btn-solid" : "btn-ghost"}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Buscar</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Produto ou SKU…" />
          <button className="btn btn-ghost btn-sm min-h-[3.0625rem]">Buscar</button>
        </form>
      </div>
      {rows.length === 0 ? <Empty><p>Nenhuma variante aqui.</p></Empty> : (
        <Table>
          <thead><tr><th>Produto</th><th>Variante</th><th>SKU</th><th>Estoque</th><th>Reservado</th><th>Disponível</th><th>Lançar</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className={v.isActive ? "" : "opacity-50"}>
                <td><Link href={`/admin/produtos/${v.product.id}`} className="hover:underline">{v.product.name}</Link></td>
                <td>{[v.colorName, v.size].filter(Boolean).join(" · ") || "Única"}</td>
                <td className="text-xs text-graphite">{v.sku}</td>
                <td className="price">{v.stock}</td>
                <td className="price">{v.reserved}</td>
                <td className={`price font-medium ${v.free <= 0 || v.free <= v.lowStockAt ? "text-wine" : ""}`}>{v.free}</td>
                <td><StockAdjust variantId={v.id} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h2 className="mb-4 mt-12 text-lg font-medium">Últimas movimentações</h2>
      {movements.length === 0 ? <p className="text-graphite">Nenhuma movimentação ainda.</p> : (
        <Table>
          <thead><tr><th>Quando</th><th>Produto</th><th>Motivo</th><th>Quantidade</th><th>Saldo</th><th>Obs.</th></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td className="price whitespace-nowrap">{dt.format(m.createdAt)}</td>
                <td>{m.variant.product.name}<span className="block text-xs text-graphite">{m.variant.sku}</span></td>
                <td>{REASON[m.reason]}</td>
                <td className="price">{m.delta > 0 ? `+${m.delta}` : m.delta || "—"}</td>
                <td className="price">{m.stockAfter}</td>
                <td className="text-graphite">{m.note}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
