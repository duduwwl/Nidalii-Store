import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/server/settings";
import { getCollections, getFeatured, getNewArrivals, sellable } from "@/server/catalog";
import { toCardData } from "@/server/card-data";
import { mpConfigured } from "@/server/payments/mercadopago";
import { ProductCard } from "@/components/store/product-card";
import { HeroReveal } from "@/components/store/hero-reveal";
import { Lookbook } from "@/components/store/lookbook";

async function activeBanners(placement: string) {
  const now = new Date();
  return db.banner.findMany({
    where: {
      placement, isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { position: "asc" },
  });
}

export default async function Home() {
  const [settings, heroes, editorials, collections, arrivals, featured, looks] = await Promise.all([
    getSettings(),
    activeBanners("hero"),
    activeBanners("editorial"),
    getCollections({ featuredOnly: true }),
    getNewArrivals(8),
    getFeatured(8),
    db.productImage.findMany({
      where: { kind: "editorial", product: sellable() },
      orderBy: [{ product: { publishedAt: "desc" } }, { position: "asc" }],
      take: 10,
      include: { product: { select: { name: true, slug: true, priceCents: true } } },
    }),
  ]);
  const hero = heroes[0];
  // Sem banner cadastrado, o topo mostra as duas peças mais recentes da loja
  const heroPhotos = hero?.imageUrl ? [] : arrivals.slice(0, 2).flatMap((p) => (p.images[0] ? [{ slug: p.slug, name: p.name, url: p.images[0].url, alt: p.images[0].alt }] : []));
  const editorial = editorials[0];
  const empty = arrivals.length === 0;

  return (
    <>
      {/* Hero: assimétrico. Foto em 7 colunas, título deslocado; sem foto, a tipografia assume. */}
      <section aria-label="Destaque" className="wrap pt-4 lg:pt-8">
        {hero?.imageUrl ? (
          <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-6">
            <HeroReveal className="lg:col-span-7">
              <picture className="photo block aspect-[4/5] lg:aspect-[5/6]">
                {hero.imageMobileUrl && <source media="(max-width: 767px)" srcSet={hero.imageMobileUrl} />}
                <Image src={hero.imageUrl} alt={hero.imageAlt ?? ""} fill priority sizes="(min-width:1024px) 58vw, 100vw" />
              </picture>
            </HeroReveal>
            <div className="grid gap-6 lg:col-span-4 lg:col-start-9 lg:pb-10">
              <h1 className="font-display text-[clamp(3.25rem,9vw,8.25rem)] leading-[0.94]">{hero.title ?? "Nidalii"}</h1>
              {hero.subtitle && <p className="max-w-[38ch] text-lg text-graphite">{hero.subtitle}</p>}
              <Link href={hero.ctaHref || "/produtos"} className="btn btn-solid w-fit">{hero.ctaLabel || "Ver produtos"}</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 py-8 lg:grid-cols-12 lg:items-end lg:gap-6 lg:py-14">
            <div className={`grid gap-8 ${heroPhotos.length ? "lg:col-span-6" : "lg:col-span-9"}`}>
              <h1 className="font-display text-display leading-[0.88]">
                Nidalii
                <span className="block pl-[12%] italic text-graphite">store</span>
              </h1>
              <div className="grid max-w-md gap-6">
                <p className="text-lg text-graphite">Moda feminina com entrega para todo o Brasil.</p>
                <Link href={empty ? "/sobre" : "/novidades"} className="btn btn-solid w-fit">{empty ? "Conheça a loja" : "Ver o que chegou"}</Link>
              </div>
            </div>
            {heroPhotos.length > 0 && (
              <HeroReveal className="lg:col-span-6">
                <div className="grid grid-cols-2 items-end gap-3 lg:gap-4">
                  {heroPhotos.map((p, i) => (
                    <Link key={p.slug} href={`/produtos/${p.slug}`} className={`photo block ${i === 1 ? "mb-[18%]" : ""}`} aria-label={p.name}>
                      <Image src={p.url} alt={p.alt} fill priority sizes="(min-width:1024px) 25vw, 50vw" />
                    </Link>
                  ))}
                </div>
              </HeroReveal>
            )}
          </div>
        )}
      </section>

      {collections.length > 0 && (
        <section aria-labelledby="colecoes-t" className="wrap mt-[var(--section)]" data-reveal>
          <div className="mb-8 flex items-end justify-between gap-6">
            <h2 id="colecoes-t" className="font-display text-2xl">Coleções</h2>
            <Link href="/colecoes" className="link text-sm">Ver todas</Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
            {collections.slice(0, 3).map((c, i, list) => {
              const cover = c.coverImage ?? c.products[0]?.product.images[0]?.url;
              const single = list.length === 1;
              return (
                <Link
                  key={c.id} href={`/colecoes/${c.slug}`}
                  className={`group relative block ${single ? "lg:col-span-12 lg:grid lg:grid-cols-12 lg:items-end lg:gap-6" : i === 0 ? "lg:col-span-7 lg:row-span-2" : "lg:col-span-5"}`}
                >
                  <span className={`photo block overflow-hidden ${single ? "aspect-[4/5] lg:col-span-7 lg:aspect-[16/11]" : i === 0 ? "aspect-[4/5]" : "aspect-[4/3] lg:aspect-[5/4]"}`}>
                    {cover ? (
                      <Image src={cover} alt="" fill sizes={i === 0 ? "(min-width:1024px) 58vw, 100vw" : "(min-width:1024px) 42vw, 100vw"}
                        className="transition-transform duration-700 ease-[var(--ease-soft)] [@media(hover:hover)]:group-hover:scale-[1.03]" />
                    ) : <span className="photo-empty absolute inset-0" />}
                  </span>
                  <span className={`mt-3 flex items-baseline justify-between gap-4 ${single ? "lg:col-span-4 lg:col-start-9 lg:mt-0 lg:grid lg:gap-3 lg:pb-4" : ""}`}>
                    <span className={`font-display italic leading-none ${single ? "text-[1.75rem] lg:text-[3.5rem]" : "text-[1.75rem] lg:text-[2.25rem]"}`}>{c.name}</span>
                    <span className="text-sm text-graphite">{c._count.products} {c._count.products === 1 ? "peça" : "peças"}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {arrivals.length > 0 && (
        <section aria-labelledby="novidades-t" className="mt-[var(--section)]" data-reveal>
          <div className="wrap mb-8 flex items-end justify-between gap-6">
            <h2 id="novidades-t" className="font-display text-2xl">Chegou agora</h2>
            <Link href="/novidades" className="link text-sm">Ver novidades</Link>
          </div>
          <ul className="wrap grid auto-cols-[68%] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:none] sm:grid-flow-row sm:grid-cols-4 sm:gap-x-3 sm:gap-y-10 sm:overflow-visible lg:gap-x-4 lg:gap-y-12" style={{ scrollPaddingInline: "var(--margin)" }}>
            {arrivals.map((p, i) => (
              <li key={p.id} className="[scroll-snap-align:start]">
                <ProductCard p={toCardData(p)} priority={i < 2 && !hero} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {editorial?.imageUrl && (
        <section aria-label="Editorial" className="wrap mt-[var(--section)]" data-reveal>
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="photo aspect-[4/5] lg:col-span-5 lg:col-start-2">
              <Image src={editorial.imageUrl} alt={editorial.imageAlt ?? ""} fill sizes="(min-width:1024px) 42vw, 100vw" />
            </div>
            <div className="grid gap-5 lg:col-span-4 lg:col-start-8">
              {editorial.title && <h2 className="font-display text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.02]">{editorial.title}</h2>}
              {editorial.subtitle && <p className="text-lg text-graphite">{editorial.subtitle}</p>}
              {editorial.ctaHref && <Link href={editorial.ctaHref} className="link w-fit">{editorial.ctaLabel || "Ver peças"}</Link>}
            </div>
          </div>
        </section>
      )}

      {looks.length >= 3 && (
        <Lookbook
          looks={looks.map((l) => ({ id: l.id, url: l.url, alt: l.alt, name: l.product.name, slug: l.product.slug, priceCents: l.product.priceCents ?? 0 }))}
        />
      )}

      {featured.length > 0 && (
        <section aria-labelledby="sel-t" className="wrap mt-[var(--section)]" data-reveal>
          <h2 id="sel-t" className="mb-8 font-display text-2xl">Escolhidas pela loja</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-12">
            {featured.map((p) => <li key={p.id}><ProductCard p={toCardData(p)} /></li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="como-t" className="wrap mt-[var(--section)]" data-reveal>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
          <h2 id="como-t" className="font-display text-2xl lg:col-span-4">Como funciona</h2>
          <dl className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:gap-x-6 lg:gap-y-10">
            <Benefit title="Entrega para todo o Brasil" text="O frete aparece pelo CEP antes de pagar, com prazo e transportadora." href="/entregas" />
            {settings.pickupAvailable && <Benefit title="Retirada na loja, sem frete" text="Avisamos quando as peças estiverem separadas." href="/entregas" />}
            {mpConfigured() && <Benefit title="Pix, crédito ou débito" text="O cartão é digitado no formulário seguro do Mercado Pago." />}
            {settings.hours.length > 0 && <Benefit title="Atendimento" text={settings.hours.map((h) => `${h.days}, ${h.open} às ${h.close}`).join(". ")} href="/contato" />}
          </dl>
        </div>
      </section>
    </>
  );
}

function Benefit({ title, text, href }: { title: string; text: string; href?: string }) {
  return (
    <div className="grid content-start gap-2">
      <dt className="font-display text-[1.625rem] leading-[1.1] lg:text-[2rem]">{href ? <Link href={href} className="hover:underline hover:decoration-1 hover:underline-offset-[6px]">{title}</Link> : title}</dt>
      <dd className="max-w-[40ch] text-graphite">{text}</dd>
    </div>
  );
}
