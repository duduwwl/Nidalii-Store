import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { availableStock, getProductBySlug, getRelated, sizeOrder } from "@/server/catalog";
import { toCardData } from "@/server/card-data";
import { getSettings } from "@/server/settings";
import { mpConfigured } from "@/server/payments/mercadopago";
import { renderMarkdown } from "@/lib/markdown";
import { formatCents } from "@/lib/money";
import { ProductPurchase } from "@/components/store/product-purchase";
import { ProductCard } from "@/components/store/product-card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Produto não encontrado" };
  const description = p.seoDescription ?? p.description?.slice(0, 155) ?? `${p.name} na Nidalii Store.`;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/produtos/${p.slug}` },
    openGraph: { title: p.name, description, images: p.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [settings, related] = await Promise.all([getSettings(), getRelated(p.id, p.categoryId)]);

  const variants = p.variants.map((v) => ({
    id: v.id, colorName: v.colorName, colorHex: v.colorHex, size: v.size,
    available: availableStock(v), priceCents: v.priceCents ?? p.priceCents!,
  }));
  const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean) as string[])].sort(sizeOrder);
  const price = p.priceCents!;
  const n = settings.installmentsWithoutInterest;
  const installmentsText = mpConfigured() && n > 1 ? `ou ${n}x de ${formatCents(Math.ceil(price / n))} sem juros no cartão` : null;
  const totalFree = variants.reduce((s, v) => s + v.available, 0);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? undefined,
    image: p.images.map((i) => (i.url.startsWith("http") ? i.url : `${siteUrl}${i.url}`)),
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Nidalii Store" },
    category: p.category?.name,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/produtos/${p.slug}`,
      priceCurrency: "BRL",
      price: (price / 100).toFixed(2),
      availability: totalFree > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Produtos", item: `${siteUrl}/produtos` },
      ...(p.category ? [{ "@type": "ListItem", position: 2, name: p.category.name, item: `${siteUrl}/produtos?categoria=${p.category.slug}` }] : []),
      { "@type": "ListItem", position: p.category ? 3 : 2, name: p.name },
    ],
  };

  return (
    <div className="pb-20 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, crumbs]).replace(/</g, "\\u003c") }} />
      <nav aria-label="Você está em" className="wrap py-4 text-sm text-graphite lg:py-6">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/produtos">Produtos</Link></li>
          {p.category && <><li aria-hidden="true">/</li><li><Link href={`/produtos?categoria=${p.category.slug}`}>{p.category.name}</Link></li></>}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">{p.name}</li>
        </ol>
      </nav>

      <div className="wrap">
        <ProductPurchase
          productId={p.id}
          name={p.name}
          category={p.category ? { name: p.category.name, slug: p.category.slug } : null}
          priceCents={price}
          compareAtCents={p.compareAtCents}
          variants={variants}
          images={p.images
            .filter((i) => i.kind === "product" || p.images.every((x) => x.kind !== "product"))
            .concat(p.images.filter((i) => i.kind === "editorial" && p.images.some((x) => x.kind === "product")))
            .map((i) => ({ id: i.id, url: i.url, alt: i.alt, width: i.width, height: i.height, colorName: i.colorName }))}
          sizeOrder={sizes}
          installmentsText={installmentsText}
          sizeGuide={settings.sizeGuide ? renderMarkdown(settings.sizeGuide) : null}
          pickup={settings.pickupAvailable ? { address: settings.storeAddress!, hours: settings.hours.map((h) => `${h.days}, ${h.open}–${h.close}`).join("; ") } : null}
          shippingConfigured={settings.shippingConfigured}
        >
          <div className="grid gap-6 text-[0.9375rem]">
            {p.description && <div className="prose-nd whitespace-pre-line">{p.description}</div>}
            {(p.composition || p.careNotes) && (
              <dl className="grid gap-4">
                {p.composition && <div><dt className="font-medium">Composição</dt><dd className="text-graphite">{p.composition}</dd></div>}
                {p.careNotes && <div><dt className="font-medium">Cuidados</dt><dd className="whitespace-pre-line text-graphite">{p.careNotes}</dd></div>}
              </dl>
            )}
          </div>
        </ProductPurchase>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="rel-t" className="wrap mt-[var(--section)]" data-reveal>
          <h2 id="rel-t" className="mb-8 font-display text-2xl">Combina com</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-4 lg:gap-x-4">
            {related.map((r) => <li key={r.id}><ProductCard p={toCardData(r)} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
