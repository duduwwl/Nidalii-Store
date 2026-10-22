"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8f7f5", color: "#0a0a0a", padding: "4rem 1.25rem" }}>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "2.25rem" }}>A loja está fora do ar por um instante.</h1>
        <p style={{ color: "#55524e" }}>Tente de novo em alguns segundos.</p>
        <button onClick={reset} style={{ background: "#0a0a0a", color: "#fff", border: 0, padding: "0.9rem 1.5rem", cursor: "pointer" }}>Tentar de novo</button>
      </body>
    </html>
  );
}
