/**
 * O único movimento automático do site: o círculo preto do "N" se abre e revela a foto.
 * CSS puro (roda fora da thread principal); desligado com prefers-reduced-motion.
 */
export function HeroReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {children}
      <div aria-hidden="true" className="hero-reveal pointer-events-none absolute inset-0 grid place-items-center bg-ink text-white">
        <span className="font-display text-[clamp(5rem,14vw,11rem)] leading-none">N</span>
      </div>
      <style>{`
        .hero-reveal { clip-path: circle(150% at 50% 50%); animation: nd-open 1.25s cubic-bezier(0.77,0,0.175,1) 0.25s forwards; }
        .hero-reveal > span { animation: nd-fade 0.5s ease 0.15s forwards; }
        @keyframes nd-open { to { clip-path: circle(0% at 50% 50%); visibility: hidden; } }
        @keyframes nd-fade { to { opacity: 0; transform: scale(0.92); } }
        @media (prefers-reduced-motion: reduce) { .hero-reveal { display: none; } }
      `}</style>
    </div>
  );
}
