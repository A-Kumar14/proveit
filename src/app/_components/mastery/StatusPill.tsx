import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { MasteryState } from "@proveit/lib/schemas";

export function StatusPill({ state, label, className }: { state: MasteryState; label?: string; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", LOOK[state].pill, className)}>{label ?? LOOK[state].label}</span>;
}
