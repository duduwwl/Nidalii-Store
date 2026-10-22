"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IconClose, IconZoom } from "../icons";

export type GalleryImage = { id: string; url: string; alt: string; width: number | null; height: number | null };

/**
 * Celular: carrossel com deslize nativo e indicador.
 * Desktop: miniaturas à esquerda e foto grande. Toque/clique abre o zoom.
 */
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const rail = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (i: number) => {
    setIndex(i);
    const el = rail.current;
    if (el && el.clientWidth) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0) {
    return <div className="photo photo-empty">Foto em breve</div>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[4.5rem_1fr] lg:gap-4">
      {images.length > 1 && (
        <ul className="hidden content-start gap-3 lg:grid" aria-label="Miniaturas">
          {images.map((img, i) => (
            <li key={img.id}>
              <button type="button" onClick={() => goTo(i)} aria-label={`Foto ${i + 1} de ${images.length}`} aria-current={i === index}
                className={`photo block w-full transition-opacity ${i === index ? "outline outline-1 outline-offset-2 outline-ink" : "opacity-60 hover:opacity-100"}`}>
                <Image src={img.url} alt="" fill sizes="72px" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative min-w-0">
        <div
          ref={rail} onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carrossel" aria-label={`Fotos de ${name}`}
        >
          {images.map((img, i) => (
            <button key={img.id} type="button" onClick={() => { setIndex(i); setZoom(true); }}
              className="photo w-full shrink-0 snap-start cursor-zoom-in" aria-label={`Ampliar foto ${i + 1}`}>
              <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="(min-width:1024px) 50vw, 100vw" />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute right-3 top-3 grid size-9 place-items-center bg-white/90"><IconZoom size={18} /></span>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden" aria-hidden="true">
            {images.map((img, i) => (
              <span key={img.id} className={`h-0.5 w-6 transition-colors ${i === index ? "bg-ink" : "bg-ink/25"}`} />
            ))}
          </div>
        )}
      </div>

      {zoom && <Zoom images={images} start={index} onClose={() => setZoom(false)} />}
    </div>
  );
}

function Zoom({ images, start, onClose }: { images: GalleryImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(images.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => { html.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [images.length, onClose]);

  const img = images[i];
  return (
    <div role="dialog" aria-modal="true" aria-label="Foto ampliada" className="fixed inset-0 z-[85] bg-white" style={{ animation: "nd-zoom-in 220ms var(--ease-soft)" }}>
      <div className="absolute inset-0 overflow-auto overscroll-contain">
        {/* Foto em 2x a largura da tela: arraste ou role para ver os detalhes */}
        <div className="relative mx-auto" style={{ width: "min(200vw, 2400px)", aspectRatio: img.width && img.height ? `${img.width}/${img.height}` : "3/4" }}>
          <Image src={img.url} alt={img.alt} fill sizes="200vw" quality={90} className="object-contain" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="price pointer-events-auto bg-white px-3 py-1.5 text-sm">{i + 1} / {images.length}</span>
        <button ref={closeRef} type="button" onClick={onClose} className="pointer-events-auto grid size-11 place-items-center bg-white" aria-label="Fechar zoom"><IconClose size={22} /></button>
      </div>
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button type="button" className="btn btn-ghost btn-sm bg-white" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
          <button type="button" className="btn btn-ghost btn-sm bg-white" disabled={i === images.length - 1} onClick={() => setI(i + 1)}>Próxima</button>
        </div>
      )}
      <style>{`@keyframes nd-zoom-in { from { opacity: 0; transform: scale(0.98); } }`}</style>
    </div>
  );
}
