import Image from "next/image";

/** Logo oficial quando enviado pelo painel; até lá, a assinatura tipográfica. */
export function Wordmark({ logoUrl, className = "" }: { logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    return (
      <span className={`relative block h-10 w-10 lg:h-12 lg:w-12 ${className}`}>
        <Image src={logoUrl} alt="Nidalii Store" fill sizes="48px" className="object-contain" priority />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-baseline gap-1.5 leading-none ${className}`} translate="no">
      <span className="font-display text-[1.375rem] tracking-[0.18em] lg:text-[1.75rem]" aria-hidden="true">NIDALII</span>
      <span className="font-display italic text-[0.9375rem] text-graphite lg:text-[1.0625rem]" aria-hidden="true">store</span>
    </span>
  );
}
