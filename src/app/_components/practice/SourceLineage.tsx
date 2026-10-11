import { BookOpenText } from "lucide-react";
import type { LearningSourceView } from "@proveit/server/sourceLineage";
import { cn } from "@proveit/lib/cn";

export function SourceLineage({ sources, showExcerpt = false, compact = false, className }: {
  sources: LearningSourceView[];
  showExcerpt?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!sources.length) return null;
  return (
    <div className={cn(compact ? "mt-1.5" : "border-t border-line px-[18px] py-3", className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
        <BookOpenText size={11} aria-hidden />Grounded in
      </div>
      <ul className={cn("m-0 list-none p-0", compact ? "mt-1 flex flex-wrap gap-1.5" : "mt-2 flex flex-col gap-2")}>
        {sources.map((source) => (
          <li key={source.id} className={cn(compact ? "rounded-full border border-line px-2 py-0.5 text-[10px] text-ink-muted" : "rounded-sm border border-line bg-surface-hover px-2.5 py-2 text-xs")}>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="font-semibold text-ink-3">{source.title}</span>
              {source.locator && <span className="text-ink-faint">· {source.locator}</span>}
              <span className="text-ink-faint">{source.retrieved ? "· course excerpt" : "· reference label"}</span>
            </div>
            {showExcerpt && source.excerpt && (
              <blockquote className="m-0 mt-1.5 border-l-2 border-line-strong pl-2 text-[11px] leading-[1.5] text-ink-muted">
                {source.excerpt}
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
