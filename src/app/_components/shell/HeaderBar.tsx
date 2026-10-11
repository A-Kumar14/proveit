import Link from "next/link";
import { StatusPill } from "../mastery/StatusPill";
import type { MasteryState } from "@proveit/lib/schemas";

export type Crumb = { label: string; href?: string };

export function HeaderBar({ crumbs, state, right }: { crumbs: Crumb[]; state?: MasteryState; right?: React.ReactNode }) {
  return (
    <header className="flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 border-b border-line bg-surface pl-16 pr-4 lg:px-7">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
        {crumbs.map((c, i) => (
          <span key={c.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-faint" aria-hidden>/</span>}
            {c.href ? <Link href={c.href} className="text-ink-muted no-underline hover:text-ink">{c.label}</Link> : <span className="font-semibold" aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
          </span>
        ))}
        {state && <StatusPill state={state} className="ml-1" />}
      </nav>
      {right && <div className="text-xs text-ink-faint">{right}</div>}
    </header>
  );
}
