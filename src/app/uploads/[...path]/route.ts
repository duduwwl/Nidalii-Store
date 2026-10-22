import { readFile, stat } from "node:fs/promises";
import { uploadPath } from "@/server/storage";

const TYPES: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif" };

/** Serve as fotos enviadas pelo painel (gravadas fora do build). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (!parts?.length || parts.some((p) => !/^[a-z0-9][a-z0-9._-]*$/i.test(p) || p.includes(".."))) {
    return new Response("Não encontrado", { status: 404 });
  }
  const ext = parts.at(-1)!.split(".").pop()!.toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response("Não encontrado", { status: 404 });
  try {
    const file = uploadPath(...parts);
    const info = await stat(file);
    if (!info.isFile()) throw new Error();
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        // nomes de arquivo são únicos: pode guardar em cache para sempre
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
