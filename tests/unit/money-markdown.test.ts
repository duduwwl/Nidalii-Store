import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseBRLToCents } from "@/lib/money";
import { renderMarkdown } from "@/lib/markdown";

describe("dinheiro", () => {
  it("lê valores no formato brasileiro", () => {
    expect(parseBRLToCents("129,90")).toBe(12990);
    expect(parseBRLToCents("1.299,90")).toBe(129990);
    expect(parseBRLToCents("R$ 59")).toBe(5900);
    expect(parseBRLToCents("12.5")).toBe(1250);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
  it("formata", () => {
    expect(formatCents(129990).replace(/\s/g, " ")).toBe("R$ 1.299,90");
    expect(centsToInput(12990)).toBe("129,90");
  });
});

describe("markdown do painel", () => {
  it("escapa HTML (impede script injetado nos textos)", () => {
    const html = renderMarkdown('<script>alert(1)</script> **ok** [x](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>ok</strong>");
    expect(html).not.toContain('href="javascript');
  });
  it("títulos, listas e tabela", () => {
    const html = renderMarkdown("## Título\n- a\n- b\n\n| T | B |\n|---|---|\n| P | 84 |");
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(html).toContain("<table");
  });
});
