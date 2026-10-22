"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { localFavorites } from "./local-favorites";
import type { ClientCart } from "@/lib/client-cart";
import { addToCartAction, setQuantityAction } from "@/app/actions/cart";
import { mergeFavoritesAction, toggleFavoriteAction } from "@/app/actions/favorites";

type Toast = { id: number; text: string; tone: "default" | "error" };

type Ctx = {
  cart: ClientCart;
  setCart: (c: ClientCart) => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (variantId: string, quantity?: number) => Promise<boolean>;
  setQty: (lineId: string, q: number) => Promise<void>;
  pending: boolean;
  favorites: Set<string>;
  toggleFavorite: (productId: string) => void;
  notify: (text: string, tone?: Toast["tone"]) => void;
  loggedIn: boolean;
};

const StoreCtx = createContext<Ctx | null>(null);
export function StoreProvider({
  initialCart, loggedIn, serverFavorites, children,
}: { initialCart: ClientCart; loggedIn: boolean; serverFavorites: string[]; children: React.ReactNode }) {
  const [cart, setCart] = useState(initialCart);
  const [seenInitial, setSeenInitial] = useState(initialCart);
  // O servidor renderizou um carrinho novo (ex.: depois do checkout): adota sem efeito extra
  if (initialCart !== seenInitial) {
    setSeenInitial(initialCart);
    setCart(initialCart);
  }
  const [cartOpen, setCartOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [accountFavs, setAccountFavs] = useState<Set<string>>(() => new Set(serverFavorites));
  const guestFavs = useSyncExternalStore(localFavorites.subscribe, localFavorites.getSnapshot, localFavorites.getServerSnapshot);
  const favorites = useMemo(() => (loggedIn ? accountFavs : new Set(guestFavs)), [loggedIn, accountFavs, guestFavs]);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ao entrar na conta, os favoritos guardados no navegador passam para a conta
  useEffect(() => {
    if (!loggedIn) return;
    const local = localFavorites.getSnapshot();
    if (!local.length) return;
    let live = true;
    mergeFavoritesAction([...local]).then((all) => {
      if (!live) return;
      setAccountFavs(new Set(all));
      localFavorites.write([]);
    });
    return () => { live = false; };
  }, [loggedIn]);

  const notify = useCallback((text: string, tone: Toast["tone"] = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), 3800);
  }, []);

  const add = useCallback(
    (variantId: string, quantity = 1) =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          const res = await addToCartAction(variantId, quantity);
          if (res.ok) {
            setCart(res.cart);
            setCartOpen(true);
            resolve(true);
          } else {
            notify(res.error, "error");
            resolve(false);
          }
        });
      }),
    [notify],
  );

  const setQty = useCallback(
    (lineId: string, q: number) =>
      new Promise<void>((resolve) => {
        startTransition(async () => {
          const res = await setQuantityAction(lineId, q);
          if (res.ok) setCart(res.cart);
          else notify(res.error, "error");
          resolve();
        });
      }),
    [notify],
  );

  const toggleFavorite = useCallback(
    (productId: string) => {
      if (!loggedIn) {
        const cur = localFavorites.getSnapshot();
        localFavorites.write(cur.includes(productId) ? cur.filter((x) => x !== productId) : [...cur, productId]);
        return;
      }
      setAccountFavs((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      toggleFavoriteAction(productId).then((r) => {
        if (!r.ok) notify("Não foi possível salvar o favorito.", "error");
      });
    },
    [loggedIn, notify],
  );

  const value = useMemo<Ctx>(
    () => ({
      cart, setCart, cartOpen, openCart: () => setCartOpen(true), closeCart: () => setCartOpen(false),
      add, setQty, pending, favorites, toggleFavorite, notify, loggedIn,
    }),
    [cart, cartOpen, add, setQty, pending, favorites, toggleFavorite, notify, loggedIn],
  );

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="contents">
        {toast && (
          <div key={toast.id} className="toast" data-tone={toast.tone}>
            {toast.text}
          </div>
        )}
      </div>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore precisa estar dentro de StoreProvider");
  return ctx;
}
