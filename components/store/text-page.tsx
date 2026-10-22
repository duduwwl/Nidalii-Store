import { renderMarkdown } from "@/lib/markdown";

export function TextPage({ title, markdown, children }: { title: string; markdown: string; children?: React.ReactNode }) {
  return (
    <div className="wrap grid gap-10 pt-8 lg:grid-cols-12 lg:gap-6 lg:pt-14">
      <h1 className="font-display text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.95] lg:col-span-4">{title}</h1>
      <div className="lg:col-span-7 lg:col-start-6">
        <div className="prose-nd text-[1.0625rem] [&>h2:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
        {children}
      </div>
    </div>
  );
}
