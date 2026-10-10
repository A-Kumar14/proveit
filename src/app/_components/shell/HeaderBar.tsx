import Link from "next/link";
import { StatusPill } from "../mastery/StatusPill";
import type { MasteryState } from "@proveit/lib/schemas";

export type Crumb = { label: string; href?: string };

export function HeaderBar({ crumbs, state, right }: { crumbs: Crumb[]; state?: MasteryState; right?: React.ReactNode }) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-7">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-faint" aria-hidden>/</span>}
            {c.href ? <Link href={c.href} className="text-ink-muted no-underline hover:text-ink">{c.label}</Link> : <span className="font-semibold" aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
          </span>
        ))}
        {state && <StatusPill state={state} className="ml-1" />}
      </nav>
      {right && <div className="truncate text-xs text-ink-faint">{right}</div>}
    </header>
  );
}
