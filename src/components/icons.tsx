// Ícones de traço fino, desenhados para o sistema. Sem bibliotecas, sem emoji.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: P) => <Base {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.6-4.6" /></Base>;
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Base {...p} fill={filled ? "currentColor" : "none"}><path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></Base>
);
export const IconUser = (p: P) => <Base {...p}><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20c.9-3.6 3.7-5.4 7.2-5.4s6.3 1.8 7.2 5.4" /></Base>;
export const IconBag = (p: P) => <Base {...p}><path d="M5.5 8h13l-1 12h-11z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></Base>;
export const IconMenu = (p: P) => <Base {...p}><path d="M3.5 8h17M3.5 16h17" /></Base>;
export const IconClose = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6L6 18" /></Base>;
export const IconMinus = (p: P) => <Base {...p}><path d="M6 12h12" /></Base>;
export const IconPlus = (p: P) => <Base {...p}><path d="M12 6v12M6 12h12" /></Base>;
export const IconChevron = ({ dir = "down", ...p }: P & { dir?: "down" | "up" | "left" | "right" }) => {
  const r = { down: 0, up: 180, left: 90, right: -90 }[dir];
  return <Base {...p} style={{ transform: `rotate(${r}deg)` }}><path d="M6 9.5l6 6 6-6" /></Base>;
};
export const IconFilter = (p: P) => <Base {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Base>;
export const IconTruck = (p: P) => <Base {...p}><path d="M3 6.5h11v9H3zM14 10h3.8l3.2 3.2v2.3h-7" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17.5" cy="17.5" r="1.7" /></Base>;
export const IconStore = (p: P) => <Base {...p}><path d="M4 9.5V20h16V9.5M3 9.5l1.6-5h14.8l1.6 5zM9.5 20v-5.5h5V20" /></Base>;
export const IconLock = (p: P) => <Base {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="1" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></Base>;
export const IconChat = (p: P) => <Base {...p}><path d="M20 12a7.5 7.5 0 0 1-11.2 6.5L4 20l1.5-4.6A7.5 7.5 0 1 1 20 12z" /></Base>;
export const IconShare = (p: P) => <Base {...p}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6.5h14V13" /></Base>;
export const IconCheck = (p: P) => <Base {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Base>;
export const IconCopy = (p: P) => <Base {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="1" /><path d="M15.5 8.5V4.5h-11v11h4" /></Base>;
export const IconRuler = (p: P) => <Base {...p}><path d="M3.5 15.5l12-12 5 5-12 12z" /><path d="M7 12l2 2M10 9l2 2M13 6l2 2" /></Base>;
export const IconInstagram = (p: P) => <Base {...p}><rect x="4" y="4" width="16" height="16" rx="4.5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></Base>;
export const IconZoom = (p: P) => <Base {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.6-4.6M10.5 8v5M8 10.5h5" /></Base>;
export const IconArrow = ({ dir = "right", ...p }: P & { dir?: "right" | "left" }) => (
  <Base {...p} style={{ transform: dir === "left" ? "scaleX(-1)" : undefined }}><path d="M4 12h15M14 7l5 5-5 5" /></Base>
);
