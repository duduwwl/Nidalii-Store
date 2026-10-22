"use client";

/** Favoritos de visitantes guardados no navegador, como um store externo para o React. */
const KEY = "nd_favoritos";
const EMPTY: readonly string[] = Object.freeze([]);
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: readonly string[] } = { raw: null, value: EMPTY };

function read(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY; // navegação privada ou armazenamento bloqueado
  }
  if (raw === cache.raw) return cache.value;
  let value: readonly string[] = EMPTY;
  try {
    const v = raw ? JSON.parse(raw) : [];
    if (Array.isArray(v)) value = v.filter((x): x is string => typeof x === "string").slice(0, 200);
  } catch {
    /* conteúdo inválido: começa vazio */
  }
  cache = { raw, value };
  return value;
}

export const localFavorites = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => e.key === KEY && cb();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot: read,
  getServerSnapshot: () => EMPTY,
  write(ids: readonly string[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* sem armazenamento: o favorito vale só até recarregar */
    }
    listeners.forEach((l) => l());
  },
};
