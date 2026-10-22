import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/ui";
import { BannerEditor } from "@/components/admin/simple-editors";

export default async function BannersPage() {
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] });
  const hero = banners.filter((b) => b.placement === "hero");
  const editorial = banners.filter((b) => b.placement === "editorial");
  return (
    <>
      <PageHeader title="Banners e home" description="A página inicial usa o primeiro destaque ativo e o primeiro bloco editorial ativo. Coleções em destaque, novidades e escolhidas são montadas a partir do catálogo." />
      <div className="grid max-w-3xl gap-10">
        <section className="grid gap-4">
          <h2 className="text-lg font-medium">Destaque principal (topo da home)</h2>
          <BannerEditor placement="hero" />
          {hero.map((b) => <BannerEditor key={b.id} banner={b} placement="hero" />)}
        </section>
        <section className="grid gap-4">
          <h2 className="text-lg font-medium">Bloco editorial</h2>
          <BannerEditor placement="editorial" />
          {editorial.map((b) => <BannerEditor key={b.id} banner={b} placement="editorial" />)}
        </section>
        <section className="grid gap-2 text-sm text-graphite">
          <h2 className="text-lg font-medium text-ink">Outras áreas da home</h2>
          <p>A faixa preta acima do menu é editada em <Link href="/admin/configuracoes" className="link">Configurações</Link>.</p>
          <p>A vitrine de looks aparece quando houver pelo menos 3 fotos editoriais em produtos à venda.</p>
          <p>“Escolhidas pela loja” mostra os produtos marcados como destaque.</p>
        </section>
      </div>
    </>
  );
}
