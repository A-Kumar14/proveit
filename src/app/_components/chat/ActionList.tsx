import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ActionList({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((a, i) => (
        <Link key={a.href} href={a.href} className="flex items-center gap-2.5 rounded-sm border border-line bg-surface-subtle px-2.5 py-2 text-[13px] text-ink no-underline hover:bg-surface-hover">
          <span className="text-[11px] text-ink-muted">{i + 1}</span>
          <span className="flex-1">{a.label}</span>
          <ChevronRight size={14} strokeWidth={2} className="text-ink-muted" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
