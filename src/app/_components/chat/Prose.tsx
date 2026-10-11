import { cn } from "@proveit/lib/cn";

/** Inline **bold** and `code`. Text goes through React, so nothing in a reply can inject markup. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? <code key={i} className="rounded-xs bg-surface-active px-1 py-px text-[0.78125rem]">{part.slice(1, -1)}</code>
          : <span key={i}>{part}</span>)}
    </>
  );
}

/** Renders a model reply: paragraphs and "- " or "1." lists, nothing else. */
export function Prose({ text, className }: { text: string; className?: string }) {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] })[] = [];
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (bullet || num) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? num)![1]!;
      if (last && last.kind === kind) last.items.push(item); else blocks.push({ kind, items: [item] });
    } else if (line.trim()) {
      if (last && last.kind === "p") last.text += ` ${line.trim()}`; else blocks.push({ kind: "p", text: line.trim() });
    } else if (last && last.kind === "p") blocks.push({ kind: "p", text: "" });
  }
  return (
    <div className={cn("flex flex-col gap-2 text-sm leading-[1.6]", className)}>
      {blocks.filter((b) => b.kind !== "p" || b.text).map((b, i) => b.kind === "p"
        ? <p key={i} className="m-0"><Inline text={b.text} /></p>
        : b.kind === "ul"
          ? <ul key={i} className="m-0 list-disc pl-5">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>
          : <ol key={i} className="m-0 list-decimal pl-5">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>)}
    </div>
  );
}
