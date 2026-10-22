import Link from "next/link";

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8 grid gap-4 lg:mb-10">
      {back && <Link href={back.href} className="w-fit text-sm text-graphite">{back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-[1.02]">{title}</h1>
          {description && <p className="max-w-[64ch] text-graphite">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`grid content-start gap-5 bg-white p-5 lg:p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          {title && <h2 className="text-lg font-medium">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid justify-items-start gap-4 border border-dashed border-line bg-white p-8 text-graphite">{children}</div>;
}

const TONES = {
  neutral: "border-line text-graphite",
  ok: "border-ok/40 text-ok",
  warn: "border-wine/40 text-wine",
  ink: "border-ink bg-ink text-white",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-xs ${TONES[tone]}`}>{children}</span>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-graphite">
        {children}
      </table>
    </div>
  );
}
