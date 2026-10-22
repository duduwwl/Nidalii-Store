"use client";

import Image from "next/image";
import Link from "next/link";
import { Drawer } from "../ui/drawer";
import { useStore } from "./store-provider";
import { formatCents } from "@/lib/money";
import { QuantityStepper } from "./quantity-stepper";

export function CartDrawer() {
  const { cart, cartOpen, closeCart, setQty, pending } = useStore();
  const empty = cart.lines.length === 0;

  return (
    <Drawer
      open={cartOpen}
      onClose={closeCart}
      title={empty ? "Sacola" : `Sacola (${cart.count})`}
      footer={
        empty ? undefined : (
          <div className="grid gap-4">
            <div className="flex items-baseline justify-between">
              <span>Subtotal</span>
              <span className="price text-lg">{formatCents(cart.subtotalCents)}</span>
            </div>
            <p className="hint -mt-2">Frete e cupom são calculados no carrinho.</p>
            {cart.hasProblems && <p className="error">Alguns itens mudaram de disponibilidade. Revise antes de continuar.</p>}
            <Link href="/checkout" onClick={closeCart} className={`btn btn-solid btn-block ${cart.hasProblems ? "pointer-events-none opacity-50" : ""}`} aria-disabled={cart.hasProblems}>
              Finalizar compra
            </Link>
            <Link href="/carrinho" onClick={closeCart} className="btn btn-ghost btn-block">Ver carrinho</Link>
          </div>
        )
      }
    >
      {empty ? (
        <div className="grid gap-5 p-6">
          <p className="text-graphite">Sua sacola está vazia.</p>
          <Link href="/produtos" onClick={closeCart} className="btn btn-solid w-fit" data-autofocus>Ver produtos</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line" aria-busy={pending}>
          {cart.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[5.5rem_1fr] gap-4 p-5">
              <Link href={`/produtos/${l.slug}`} onClick={closeCart} className="photo block" tabIndex={-1}>
                {l.image ? <Image src={l.image.url} alt={l.image.alt} fill sizes="88px" /> : <span className="photo-empty">Sem foto</span>}
              </Link>
              <div className="grid content-start gap-1 min-w-0">
                <Link href={`/produtos/${l.slug}`} onClick={closeCart} className="font-medium leading-snug">{l.name}</Link>
                <p className="text-sm text-graphite">{[l.colorName, l.size && `Tam. ${l.size}`].filter(Boolean).join(", ")}</p>
                <p className="price text-sm">{formatCents(l.totalCents)}</p>
                {l.problem && <p className="error">{l.problem}</p>}
                <div className="mt-2 flex items-center gap-4">
                  <QuantityStepper
                    value={l.quantity}
                    max={Math.max(1, Math.min(10, l.available))}
                    onChange={(q) => setQty(l.id, q)}
                    disabled={pending}
                    label={`Quantidade de ${l.name}`}
                  />
                  <button type="button" className="text-sm underline underline-offset-4" onClick={() => setQty(l.id, 0)} disabled={pending}>
                    Remover
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
