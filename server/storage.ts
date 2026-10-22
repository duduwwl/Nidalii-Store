import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400; // lado maior da foto guardada

export type StoredImage = { url: string; width: number; height: number };

export class UploadError extends Error {}

/** Caminho dentro da pasta de uploads (escopo fixo, para o build não rastrear o projeto inteiro). */
export function uploadPath(...parts: string[]) {
  const custom = process.env.STORAGE_DIR;
  return custom ? path.join(custom, ...parts) : path.join(process.cwd(), "storage", "uploads", ...parts);
}

/**
 * Valida e reprocessa a imagem: decodifica com o sharp (rejeita arquivos que não são imagem),
 * corrige a rotação do celular, remove metadados (inclusive localização) e grava em WebP.
 * As cores e o recorte originais são preservados.
 *
 * Armazenamento: pasta local (STORAGE_DIR, padrão storage/uploads), servida pela rota /uploads.
 * Em hospedagem sem disco persistente (Vercel), troque por um bucket — ver DEPLOY.md.
 */
export async function storeImage(file: File, folder: string): Promise<StoredImage> {
  if (file.size === 0) throw new UploadError("Arquivo vazio.");
  if (file.size > MAX_BYTES) throw new UploadError("A foto passa de 15 MB.");
  const input = Buffer.from(await file.arrayBuffer());

  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new UploadError("O arquivo não é uma imagem válida.");
  }
  if (!meta.format || !["jpeg", "png", "webp", "avif", "heif", "tiff"].includes(meta.format)) {
    throw new UploadError("Use fotos em JPG, PNG, WebP, AVIF ou HEIC.");
  }

  const { data, info } = await sharp(input, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .webp({ quality: 86, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "geral";
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.webp`;
  await mkdir(uploadPath(safeFolder), { recursive: true });
  await writeFile(uploadPath(safeFolder, name), data);
  return { url: `/uploads/${safeFolder}/${name}`, width: info.width, height: info.height };
}

export async function deleteStoredImage(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const rel = url.replace(/^\/uploads\//, "");
  if (rel.split("/").some((p) => p === ".." || p === "")) return; // nunca sai da pasta de uploads
  const target = uploadPath(...rel.split("/"));
  await unlink(target).catch(() => undefined);
}
