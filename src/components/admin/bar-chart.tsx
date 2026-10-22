"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type Point = { label: string; date: string; value: number; orders: number };

/**
 * Barras de uma série (receita confirmada por dia). Uma série: sem legenda, o título nomeia.
 * Hover/foco mostra o valor; a tabela fica disponível para leitores de tela.
 */
export function RevenueChart({ data, title }: { data: Point[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, padL = 56, padB = 28, padT = 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const bw = (W - padL) / data.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / top);
  const active = hover != null ? data[hover] : null;
  const labelStep = Math.ceil(data.length / 8);

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-lg font-medium">{title}</span>
        <span className="price text-sm text-graphite" aria-live="polite">
          {active ? `${active.label}: ${formatCents(active.value)} · ${active.orders} ${active.orders === 1 ? "pedido" : "pedidos"}` : `Total ${formatCents(data.reduce((s, d) => s + d.value, 0))}`}
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[32rem]" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--color-graphite)" className="price">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = Math.max(0, y(0) - y(d.value));
            const x = padL + i * bw + 1;
            const w = Math.max(1, bw - 2); // 2px de respiro entre barras
            const r = Math.min(4, w / 2, h);
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${formatCents(d.value)}`}>
                <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${y(d.value) + r} q0,-${r} ${r},-${r} H${x + w - r} q${r},0 ${r},${r} V${y(0)} Z`}
                    fill={hover == null || hover === i ? "var(--color-ink)" : "var(--color-graphite)"}
                    opacity={hover == null || hover === i ? 1 : 0.35}
                  />
                )}
                {/* rótulos espaçados; o último dia sempre aparece, sem encostar no anterior */}
                {((i % labelStep === 0 && data.length - 1 - i >= labelStep / 2) || i === data.length - 1) && (
                  <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-graphite)">{d.label}</text>
                )}
              </g>
            );
          })}
          <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-graphite)" strokeWidth={1} />
        </svg>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-graphite">Ver em tabela</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <thead><tr><th className="py-1 font-medium">Dia</th><th className="py-1 font-medium">Pedidos</th><th className="py-1 text-right font-medium">Receita</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.date} className="border-t border-line"><td className="py-1">{d.label}</td><td className="price py-1">{d.orders}</td><td className="price py-1 text-right">{formatCents(d.value)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}
function compact(cents: number) {
  const r = cents / 100;
  if (r >= 1000) return `R$ ${(r / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${r.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
