"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Entrada editorial: as partes de cada seção marcada com data-reveal sobem 16px e aparecem
 * em sequência quando a seção entra na tela. Sem JavaScript ou com movimento reduzido,
 * tudo já aparece no lugar (a classe só é ligada aqui).
 */
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-reveal");
    const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = "";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
