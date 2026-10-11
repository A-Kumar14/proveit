import { Check, Minus } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { MasteryState } from "@proveit/lib/schemas";

export const NodeIcon = ({ state }: { state: MasteryState }) =>
  state === "mastered" || state === "provisional" ? <Check size={16} strokeWidth={3} className="text-mastered" aria-hidden />
  : state === "developing" ? (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" fill="none" stroke="var(--color-developing)" strokeWidth="2.4" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="var(--color-developing)" />
    </svg>
  )
  : state === "needs_work" ? <span aria-hidden className="text-base font-bold leading-none text-needswork">!</span>
  : <Minus size={16} strokeWidth={2.4} className="text-ink-faint" aria-hidden />;

export function ConceptNode({ id, name, short, x, y, state, selected, onSelect }: {
  id: string; name: string; short: string; x: number; y: number; state: MasteryState; selected: boolean; onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button" onClick={() => onSelect(id)} aria-pressed={selected} aria-label={`${name}, ${LOOK[state].label}`}
        style={{ left: `${(x / 480) * 100}%`, top: `${(y / 336) * 100}%` }}
        className={cn("absolute flex size-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-2 p-0", LOOK[state].node, selected && "outline-2 outline-offset-4 outline-ink")}
      >
        <NodeIcon state={state} />
      </button>
      <span style={{ left: `${(x / 480) * 100}%`, top: `${(y / 336) * 100}%` }} className={cn("pointer-events-none absolute w-[110px] -translate-x-1/2 translate-y-6 text-center text-[0.6875rem]", selected ? "font-semibold text-ink" : "text-ink-muted")}>
        {short}
      </span>
    </>
  );
}
