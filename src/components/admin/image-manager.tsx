"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { deleteImageAction, moveImageAction, updateImageAction, uploadImagesAction } from "@/app/admin/actions/products";
import { FormMessage, Submit } from "../ui/form";

type Img = { id: string; url: string; alt: string; colorName: string | null; kind: string; needsBetterPhoto: boolean };

export function ImageManager({ productId, images, colors }: { productId: string; images: Img[]; colors: string[] }) {
  const [state, action] = useActionState(uploadImagesAction.bind(null, productId), null);
  const [previews, setPreviews] = useState<string[]>([]);
  return (
    <section className="grid gap-5 bg-white p-5 lg:p-6" aria-labelledby="fotos-t">
      <div>
        <h2 id="fotos-t" className="text-lg font-medium">Fotos</h2>
        <p className="hint mt-1">
          Fotos de produto aparecem no catálogo; fotos editoriais (com modelo e cenário) entram na página do produto e na vitrine de looks.
          A foto é convertida para WebP, girada conforme o celular e sem dados de localização. Cores e recorte são mantidos.
        </p>
      </div>

      <form action={async (fd) => { await action(fd); setPreviews([]); }} className="grid gap-4 border border-dashed border-line p-4">
        <FormMessage state={state} />
        <div className="field">
          <label htmlFor="files">Escolher fotos</label>
          <input id="files" name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" required
            className="text-sm file:mr-3 file:border file:border-ink file:bg-white file:px-3 file:py-2 file:font-medium"
            onChange={(e) => setPreviews([...(e.target.files ?? [])].slice(0, 20).map((f) => URL.createObjectURL(f)))} />
        </div>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previews.map((src) => <img key={src} src={src} alt="" className="h-20 w-16 object-cover" />)}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="kind">Tipo</label>
            <select id="kind" name="kind" className="select" defaultValue="product">
              <option value="product">Produto (fundo neutro)</option>
              <option value="editorial">Editorial (modelo, cenário)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="colorName">Cor mostrada (opcional)</label>
            <input id="colorName" name="colorName" className="input" list="cores-produto" placeholder="Todas as cores" />
            <datalist id="cores-produto">{colors.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        </div>
        <Submit pendingText="Enviando e otimizando…" className="btn btn-solid w-fit">Enviar fotos</Submit>
      </form>

      {images.length === 0 ? (
        <p className="text-graphite">Nenhuma foto ainda.</p>
      ) : (
        <ul className="grid gap-4">
          {images.map((img, i) => <ImageRow key={img.id} img={img} first={i === 0} last={i === images.length - 1} index={i} />)}
        </ul>
      )}
    </section>
  );
}

function ImageRow({ img, first, last, index }: { img: Img; first: boolean; last: boolean; index: number }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className={`grid grid-cols-[5rem_1fr] gap-4 border-t border-line pt-4 ${pending ? "opacity-60" : ""}`}>
      <div className="grid gap-2">
        <span className="photo block"><Image src={img.url} alt="" fill sizes="80px" /></span>
        <span className="text-center text-xs text-graphite">{index === 0 ? "Capa" : `Foto ${index + 1}`}</span>
      </div>
      <form action={(fd) => start(() => updateImageAction(img.id, fd))} className="grid gap-3 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor={`alt-${img.id}`}>Descrição da foto (acessibilidade)</label>
          <input id={`alt-${img.id}`} name="alt" className="input" defaultValue={img.alt} required minLength={3} />
        </div>
        <div className="field">
          <label htmlFor={`cor-${img.id}`}>Cor</label>
          <input id={`cor-${img.id}`} name="colorName" className="input" defaultValue={img.colorName ?? ""} placeholder="Todas" />
        </div>
        <div className="field">
          <label htmlFor={`kind-${img.id}`}>Tipo</label>
          <select id={`kind-${img.id}`} name="kind" className="select" defaultValue={img.kind}>
            <option value="product">Produto</option><option value="editorial">Editorial</option>
          </select>
        </div>
        <label className="check text-sm sm:col-span-2"><input type="checkbox" name="needsBetterPhoto" defaultChecked={img.needsBetterPhoto} /><span>Precisa de uma foto melhor</span></label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button className="btn btn-ghost btn-sm" disabled={pending}>Salvar</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={first || pending} onClick={() => start(() => moveImageAction(img.id, -1))} aria-label="Mover para antes">Subir</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={last || pending} onClick={() => start(() => moveImageAction(img.id, 1))} aria-label="Mover para depois">Descer</button>
          {confirm ? (
            <>
              <button type="button" className="btn btn-sm !border-wine !bg-wine text-white" onClick={() => start(() => deleteImageAction(img.id))}>Confirmar exclusão</button>
              <button type="button" className="text-sm underline" onClick={() => setConfirm(false)}>Cancelar</button>
            </>
          ) : (
            <button type="button" className="text-sm text-wine underline underline-offset-4" onClick={() => setConfirm(true)}>Excluir</button>
          )}
        </div>
      </form>
    </li>
  );
}
