import Link from "next/link";

/** Suggestion chips pinned under the conversation. Links only, so every chip goes somewhere real. */
export function ChipRow({ chips }: { chips: { label: string; href: string }[] }) {
  if (chips.length === 0) return null;
  return (
    <nav aria-label="Suggestions" className="flex shrink-0 flex-wrap gap-2 px-7 pb-4 pt-2">
      {chips.map((c) => (
        <Link key={c.label} href={c.href} className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-3 no-underline hover:bg-surface-hover">{c.label}</Link>
      ))}
    </nav>
  );
}
