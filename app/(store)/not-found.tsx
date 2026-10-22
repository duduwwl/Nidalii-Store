import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap grid justify-items-start gap-6 py-20 lg:py-32">
      <p className="font-display text-[clamp(5rem,16vw,12rem)] leading-none">404</p>
      <h1 className="font-display text-2xl">Esta página não existe ou saiu do ar.</h1>
      <p className="max-w-[48ch] text-graphite">Se você seguiu um link de produto, ele pode ter esgotado. Veja o que está disponível agora.</p>
      <div className="flex gap-3"><Link href="/produtos" className="btn btn-solid">Ver produtos</Link><Link href="/" className="btn btn-ghost">Página inicial</Link></div>
    </div>
  );
}
