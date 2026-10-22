"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import {
  deleteBannerAction, deleteCategoryAction, deleteCollectionAction, saveBannerAction, saveCategoryAction,
  saveCollectionAction, saveCouponAction, toggleCouponAction,
} from "@/app/admin/actions/store";
import { centsToInput, formatCents } from "@/lib/money";
import { FormMessage, Submit, TextField } from "../ui/form";

const day = (d: Date | null | undefined) => (d ? new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10) : "");

function Collapsible({ title, meta, open: initial = false, children }: { title: string; meta?: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-graphite">{meta}</span>
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

function DeleteButton({ onDelete, label = "Excluir" }: { onDelete: () => Promise<unknown>; label?: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <span className="flex gap-2">
      <button type="button" className="btn btn-sm !border-wine !bg-wine text-white" disabled={pending} onClick={() => start(async () => { await onDelete(); })}>Confirmar</button>
      <button type="button" className="text-sm underline" onClick={() => setConfirm(false)}>Cancelar</button>
    </span>
  ) : (
    <button type="button" className="text-sm text-wine underline underline-offset-4" onClick={() => setConfirm(true)}>{label}</button>
  );
}

// ─── Categoria ───
type Cat = { id: string; name: string; slug: string; description: string | null; position: number; isVisible: boolean };
export function CategoryEditor({ category, count }: { category?: Cat; count?: number }) {
  const [state, action] = useActionState(saveCategoryAction.bind(null, category?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const form = (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <TextField name="name" label="Nome" defaultValue={category?.name} required error={fe.name} id={`n-${category?.id ?? "new"}`} />
      <TextField name="slug" label="Endereço" defaultValue={category?.slug} hint="Ex.: vestidos" id={`s-${category?.id ?? "new"}`} />
      <TextField name="description" label="Descrição (aparece no topo da categoria)" defaultValue={category?.description ?? ""} className="sm:col-span-2" id={`d-${category?.id ?? "new"}`} />
      <TextField name="position" label="Ordem" type="number" min={0} defaultValue={category?.position ?? 0} id={`p-${category?.id ?? "new"}`} />
      <label className="check self-end pb-3"><input type="checkbox" name="isVisible" defaultChecked={category?.isVisible ?? true} /><span>Visível na loja</span></label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Submit className="btn btn-solid btn-sm">{category ? "Salvar" : "Criar categoria"}</Submit>
        {category && <DeleteButton onDelete={() => deleteCategoryAction(category.id)} />}
      </div>
    </form>
  );
  return category ? <Collapsible title={category.name} meta={`${count ?? 0} produtos${category.isVisible ? "" : " · oculta"}`}>{form}</Collapsible> : <Collapsible title="Nova categoria" open={false}>{form}</Collapsible>;
}

// ─── Coleção ───
type Col = { id: string; name: string; slug: string; description: string | null; coverImage: string | null; isFeatured: boolean; isVisible: boolean; position: number; startsAt: Date | null; endsAt: Date | null };
export function CollectionEditor({ collection, count }: { collection?: Col; count?: number }) {
  const [state, action] = useActionState(saveCollectionAction.bind(null, collection?.id ?? null), null);
  const k = collection?.id ?? "new";
  const form = (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <TextField name="name" label="Nome" defaultValue={collection?.name} required error={state?.fieldErrors?.name} id={`cn-${k}`} />
      <TextField name="slug" label="Endereço" defaultValue={collection?.slug} id={`cs-${k}`} />
      <div className="field sm:col-span-2"><label htmlFor={`cd-${k}`}>Descrição</label><textarea id={`cd-${k}`} name="description" className="textarea !min-h-20" defaultValue={collection?.description ?? ""} maxLength={600} /></div>
      <div className="field">
        <label htmlFor={`cc-${k}`}>Capa</label>
        {collection?.coverImage && <span className="photo mb-2 block w-24"><Image src={collection.coverImage} alt="" fill sizes="96px" /></span>}
        <input id={`cc-${k}`} name="cover" type="file" accept="image/*" className="text-sm" />
        {collection?.coverImage && <label className="check mt-2 text-sm"><input type="checkbox" name="removeCover" /><span>Remover capa</span></label>}
        <p className="hint">Sem capa, usa a foto do primeiro produto.</p>
      </div>
      <div className="grid content-start gap-3">
        <TextField name="position" label="Ordem" type="number" min={0} defaultValue={collection?.position ?? 0} id={`cp-${k}`} />
        <label className="check"><input type="checkbox" name="isVisible" defaultChecked={collection?.isVisible ?? true} /><span>Visível</span></label>
        <label className="check"><input type="checkbox" name="isFeatured" defaultChecked={collection?.isFeatured} /><span>Destaque na página inicial</span></label>
      </div>
      <TextField name="startsAt" label="Começa em (opcional)" type="date" defaultValue={day(collection?.startsAt)} id={`ci-${k}`} />
      <TextField name="endsAt" label="Termina em (opcional)" type="date" defaultValue={day(collection?.endsAt)} id={`cf-${k}`} />
      <p className="hint sm:col-span-2">Para escolher as peças, marque a coleção na página de cada produto.</p>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Submit className="btn btn-solid btn-sm">{collection ? "Salvar" : "Criar coleção"}</Submit>
        {collection && <DeleteButton onDelete={() => deleteCollectionAction(collection.id)} />}
      </div>
    </form>
  );
  return collection
    ? <Collapsible title={collection.name} meta={`${count ?? 0} peças${collection.isFeatured ? " · destaque" : ""}${collection.isVisible ? "" : " · oculta"}`}>{form}</Collapsible>
    : <Collapsible title="Nova coleção">{form}</Collapsible>;
}

// ─── Cupom ───
type Cup = { id: string; code: string; description: string | null; type: "PERCENT" | "FIXED"; value: number; minOrderCents: number | null; maxUses: number | null; maxUsesPerCustomer: number | null; usedCount: number; startsAt: Date | null; endsAt: Date | null; isActive: boolean };
export function CouponEditor({ coupon }: { coupon?: Cup }) {
  const [state, action] = useActionState(saveCouponAction.bind(null, coupon?.id ?? null), null);
  const [type, setType] = useState(coupon?.type ?? "PERCENT");
  const [pending, start] = useTransition();
  const fe = state?.fieldErrors ?? {};
  const k = coupon?.id ?? "new";
  const form = (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
      <TextField name="code" label="Código" defaultValue={coupon?.code} required className="uppercase" error={fe.code} id={`k-${k}`} />
      <div className="field">
        <label htmlFor={`t-${k}`}>Tipo</label>
        <select id={`t-${k}`} name="type" className="select" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "FIXED")}><option value="PERCENT">Porcentagem</option><option value="FIXED">Valor fixo</option></select>
      </div>
      <TextField name="value" label={type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"} inputMode="decimal" defaultValue={coupon ? (coupon.type === "PERCENT" ? coupon.value : centsToInput(coupon.value)) : ""} required error={fe.value} id={`v-${k}`} />
      <TextField name="description" label="Descrição interna" defaultValue={coupon?.description ?? ""} className="sm:col-span-3" id={`d-${k}`} />
      <TextField name="minOrder" label="Pedido mínimo (R$)" inputMode="decimal" defaultValue={centsToInput(coupon?.minOrderCents)} id={`m-${k}`} />
      <TextField name="maxUses" label="Limite total de usos" type="number" min={1} defaultValue={coupon?.maxUses ?? ""} id={`u-${k}`} />
      <TextField name="maxUsesPerCustomer" label="Usos por cliente" type="number" min={1} defaultValue={coupon?.maxUsesPerCustomer ?? ""} id={`c-${k}`} />
      <TextField name="startsAt" label="Válido de" type="date" defaultValue={day(coupon?.startsAt)} id={`i-${k}`} />
      <TextField name="endsAt" label="Válido até" type="date" defaultValue={day(coupon?.endsAt)} id={`f-${k}`} />
      <label className="check self-end pb-3"><input type="checkbox" name="isActive" defaultChecked={coupon?.isActive ?? true} /><span>Ativo</span></label>
      <div className="flex items-center gap-4 sm:col-span-3">
        <Submit className="btn btn-solid btn-sm">{coupon ? "Salvar" : "Criar cupom"}</Submit>
        {coupon && <button type="button" className="text-sm underline underline-offset-4" disabled={pending} onClick={() => start(() => toggleCouponAction(coupon.id, !coupon.isActive))}>{coupon.isActive ? "Desativar" : "Ativar"}</button>}
      </div>
    </form>
  );
  if (!coupon) return <Collapsible title="Novo cupom">{form}</Collapsible>;
  const val = coupon.type === "PERCENT" ? `${coupon.value}%` : formatCents(coupon.value);
  return <Collapsible title={coupon.code} meta={`${val} · ${coupon.usedCount}${coupon.maxUses ? `/${coupon.maxUses}` : ""} usos${coupon.isActive ? "" : " · inativo"}`}>{form}</Collapsible>;
}

// ─── Banner ───
type Ban = { id: string; placement: string; title: string | null; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string | null; imageMobileUrl: string | null; imageAlt: string | null; position: number; isActive: boolean; startsAt: Date | null; endsAt: Date | null };
export function BannerEditor({ banner, placement }: { banner?: Ban; placement: "hero" | "editorial" }) {
  const [state, action] = useActionState(saveBannerAction.bind(null, banner?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  const k = banner?.id ?? `new-${placement}`;
  const form = (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="placement" value={banner?.placement ?? placement} />
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <div className="field">
        <label htmlFor={`img-${k}`}>Foto {placement === "hero" ? "(vertical, 4:5)" : "(vertical)"}</label>
        {banner?.imageUrl && <span className="photo mb-2 block w-28"><Image src={banner.imageUrl} alt="" fill sizes="112px" /></span>}
        <input id={`img-${k}`} name="image" type="file" accept="image/*" className="text-sm" aria-invalid={!!fe.image} />
        {fe.image && <p className="error">{fe.image}</p>}
      </div>
      {placement === "hero" ? (
        <div className="field">
          <label htmlFor={`imgm-${k}`}>Foto para celular (opcional)</label>
          {banner?.imageMobileUrl && <span className="photo mb-2 block w-20"><Image src={banner.imageMobileUrl} alt="" fill sizes="80px" /></span>}
          <input id={`imgm-${k}`} name="imageMobile" type="file" accept="image/*" className="text-sm" />
        </div>
      ) : <div />}
      <TextField name="imageAlt" label="Descrição da foto" defaultValue={banner?.imageAlt ?? ""} className="sm:col-span-2" error={fe.imageAlt} hint="Ex.: Modelo com vestido longo verde em jardim." id={`alt-${k}`} />
      <TextField name="title" label="Título" defaultValue={banner?.title ?? ""} maxLength={80} id={`t-${k}`} />
      <TextField name="subtitle" label="Texto curto" defaultValue={banner?.subtitle ?? ""} maxLength={240} id={`st-${k}`} />
      <TextField name="ctaLabel" label="Texto do botão" defaultValue={banner?.ctaLabel ?? ""} placeholder="Ver a coleção" id={`cl-${k}`} />
      <TextField name="ctaHref" label="Link do botão" defaultValue={banner?.ctaHref ?? ""} placeholder="/colecoes/verao" error={fe.ctaHref} id={`ch-${k}`} />
      <TextField name="startsAt" label="Começa em" type="date" defaultValue={day(banner?.startsAt)} id={`bi-${k}`} />
      <TextField name="endsAt" label="Termina em" type="date" defaultValue={day(banner?.endsAt)} id={`bf-${k}`} />
      <TextField name="position" label="Ordem" type="number" min={0} defaultValue={banner?.position ?? 0} id={`bp-${k}`} />
      <label className="check self-end pb-3"><input type="checkbox" name="isActive" defaultChecked={banner?.isActive ?? true} /><span>Ativo</span></label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Submit className="btn btn-solid btn-sm" pendingText="Enviando…">{banner ? "Salvar" : "Criar"}</Submit>
        {banner && <DeleteButton onDelete={() => deleteBannerAction(banner.id)} />}
      </div>
    </form>
  );
  return banner
    ? <Collapsible title={banner.title || "Sem título"} meta={banner.isActive ? "ativo" : "inativo"}>{form}</Collapsible>
    : <Collapsible title={placement === "hero" ? "Novo destaque principal" : "Novo bloco editorial"}>{form}</Collapsible>;
}
