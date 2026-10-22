"use client";

import { useEffect, useId, useRef } from "react";
import { IconClose } from "../icons";

/** Gaveta lateral acessível: Esc fecha, foco preso dentro, volta o foco ao gatilho. */
export function Drawer({
  open, onClose, title, side = "right", children, footer, width,
}: {
  open: boolean; onClose: () => void; title: string; side?: "right" | "left";
  children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus], button, a, input")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      html.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`drawer ${side === "left" ? "drawer-left" : ""}`}
        data-open={open}
        inert={!open}
        style={width ? { width } : undefined}
      >
        <div className="flex items-center justify-between gap-4 px-5 h-[var(--header-h)] border-b border-line shrink-0">
          <h2 id={titleId} className="font-display text-[1.375rem]">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 grid size-11 place-items-center" aria-label="Fechar">
            <IconClose size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-line p-5">{footer}</div>}
      </div>
    </>
  );
}
