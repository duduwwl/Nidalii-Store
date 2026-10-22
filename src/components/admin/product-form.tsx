"use client";

import { useActionState } from "react";
import { saveProductAction } from "@/app/admin/actions/products";
import { centsToInput } from "@/lib/money";
import { FormMessage, Submit, TextField } from "../ui/form";

type P = {
  id: string; name: string; slug: string; description: string | null; composition: string | null; careNotes: string | null;
  categoryId: string | null; priceCents: number | null; compareAtCents: number | null; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isFeatured: boolean; featuredPosition: number; weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null;
  sourceUrl: string | null; seoTitle: string | null; seoDescription: string | null; collectionIds: string[];
};

export function ProductForm({ product, categories, collections }: { product?: P; categories: { id: string; name: string }[]; collections: { id: string; name: string }[] }) {
  const [state, action] = useActionState(saveProductAction.bind(null, product?.id ?? null), null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-6">
      <FormMessage state={state} />
      <section className="grid gap-5 bg-white p-5 lg:grid-cols-2 lg:p-6">
        <h2 className="text-lg font-medium lg:col-span-2">Informações</h2>
        <TextField name="name" label="Nome do produto" defaultValue={product?.name} required error={fe.name} className="lg:col-span-2" />
        <div className="field lg:col-span-2">
          <label htmlFor="f-description">Descrição</label>
          <textarea id="f-description" name="description" className="textarea" rows={5} defaultValue={product?.description ?? ""} maxLength={5000} />
          <p className="hint">Modelagem, caimento, detalhes. Escreva como a loja fala com as clientes.</p>
        </div>
        <TextField name="composition" label="Composição do tecido" placeholder="Ex.: 100% viscose" defaultValue={product?.composition ?? ""} />
        <div className="field">
          <label htmlFor="f-categoryId">Categoria</label>
          <select id="f-categoryId" name="categoryId" className="select" defaultValue={product?.categoryId ?? ""}>
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {categories.length === 0 && <p className="hint">Crie categorias em Catálogo › Categorias.</p>}
        </div>
        <div className="field lg:col-span-2">
          <label htmlFor="f-careNotes">Cuidados com a peça</label>
          <textarea id="f-careNotes" name="careNotes" className="textarea !min-h-20" defaultValue={product?.careNotes ?? ""} maxLength={1000} />
        </div>
        {collections.length > 0 && (
          <fieldset className="grid gap-2 lg:col-span-2">
            <legend className="label mb-2">Coleções</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {collections.map((c) => (
                <label key={c.id} className="check"><input type="checkbox" name="collectionIds" value={c.id} defaultChecked={product?.collectionIds.includes(c.id)} /><span>{c.name}</span></label>
              ))}
            </div>
          </fieldset>
        )}
      </section>

      <section className="grid gap-5 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
        <h2 className="text-lg font-medium sm:col-span-2 lg:col-span-4">Preço e vitrine</h2>
        <TextField name="price" label="Preço (R$)" inputMode="decimal" placeholder="0,00" defaultValue={centsToInput(product?.priceCents)} error={fe.priceCents} hint="Só aparece na loja com preço." />
        <TextField name="compareAt" label="Preço “de” (R$)" inputMode="decimal" placeholder="Opcional" defaultValue={centsToInput(product?.compareAtCents)} error={fe.compareAtCents} hint="Preencha para mostrar promoção." />
        {product && (
          <div className="field">
            <label htmlFor="f-status">Situação</label>
            <select id="f-status" name="status" className="select" defaultValue={product.status}>
              <option value="DRAFT">Rascunho (fora da loja)</option>
              <option value="ACTIVE">Na loja</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
          </div>
        )}
        <div className="grid content-end gap-2">
          <label className="check"><input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured} /><span>Mostrar em “Escolhidas pela loja”</span></label>
          <TextField name="featuredPosition" label="Ordem no destaque" inputMode="numeric" defaultValue={product?.featuredPosition ?? 0} />
        </div>
      </section>

      <section className="grid gap-5 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="text-lg font-medium">Peso e medidas da embalagem</h2>
          <p className="hint mt-1">Usados na cotação do frete. Em branco, valem os padrões de Frete e retirada.</p>
        </div>
        <TextField name="weightGrams" label="Peso (g)" inputMode="numeric" defaultValue={product?.weightGrams ?? ""} />
        <TextField name="lengthCm" label="Comprimento (cm)" inputMode="numeric" defaultValue={product?.lengthCm ?? ""} />
        <TextField name="widthCm" label="Largura (cm)" inputMode="numeric" defaultValue={product?.widthCm ?? ""} />
        <TextField name="heightCm" label="Altura (cm)" inputMode="numeric" defaultValue={product?.heightCm ?? ""} />
      </section>

      <details className="bg-white p-5 lg:p-6">
        <summary className="cursor-pointer text-lg font-medium">Busca do Google e origem</summary>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextField name="slug" label="Endereço da página" defaultValue={product?.slug} hint="Gerado pelo nome. Só letras, números e hífen." />
          <TextField name="sourceUrl" label="Post de origem no Instagram" type="url" defaultValue={product?.sourceUrl ?? ""} error={fe.sourceUrl} />
          <TextField name="seoTitle" label="Título no Google" maxLength={70} defaultValue={product?.seoTitle ?? ""} hint="Até 70 caracteres. Vazio usa o nome." />
          <TextField name="seoDescription" label="Descrição no Google" maxLength={170} defaultValue={product?.seoDescription ?? ""} hint="Até 170 caracteres." />
        </div>
      </details>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-line bg-paper px-4 py-3 lg:-mx-10 lg:px-10">
        <Submit>{product ? "Salvar produto" : "Criar e continuar"}</Submit>
      </div>
    </form>
  );
}
