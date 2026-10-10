import { cn } from "@proveit/lib/cn";

/** CourseProgressBar and skill bars. Always paired with a number or label by the caller. */
export function MasteryBar({ pct, barClass, label, className }: { pct: number; barClass: string; label?: string; className?: string }) {
  return (
    <div role="img" aria-label={label ?? `${pct}%`} className={cn("h-1.5 flex-1 rounded-full bg-surface-active", className)}>
      <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
