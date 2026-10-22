"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { orderStatusAction } from "@/app/actions/checkout";

/** Consulta a situação do pedido a cada 5 s enquanto a página estiver visível. */
export function StatusWatcher({ orderId, token, successUrl, failureUrl }: { orderId: string; token: string; successUrl: string; failureUrl: string }) {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const s = await orderStatusAction(orderId, token);
          if (s.paid) return router.replace(successUrl);
          if (s.status === "PAYMENT_FAILED" || s.status === "CANCELED") return router.replace(failureUrl);
        } catch { /* rede instável: tenta de novo */ }
      }
      timer = setTimeout(check, 5000);
    };
    timer = setTimeout(check, 4000);
    return () => { stop = true; clearTimeout(timer); };
  }, [orderId, token, successUrl, failureUrl, router]);
  return <p className="text-sm text-graphite" aria-live="polite">Esta página atualiza sozinha quando o pagamento for confirmado.</p>;
}
