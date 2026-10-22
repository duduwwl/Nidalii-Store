/**
 * Markdown mínimo e seguro para textos do painel (políticas, guia de medidas, sobre).
 * Escapa todo HTML antes de aplicar a formatação. Suporta: ## títulos, listas, **negrito**,
 * *itálico*, [links](https://...) e tabelas simples com "|".
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:)[^)\s]+)\)/g, (_m, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
}

export function renderMarkdown(src: string | null | undefined): string {
  if (!src) return "";
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr>${head.map((c) => `<th class="border-b border-line py-2 pr-4 text-left font-medium">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td class="border-b border-line py-2 pr-4 price">${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) {
      para.push(inline(lines[i]));
      i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}
