import { cn } from "@proveit/lib/cn";
import type { EvidenceAttemptView } from "@proveit/server/store";

const LABEL = {
  initial: "Initial answer",
  clarification: "Clarification",
  transfer: "New-question proof",
  review: "Delayed review",
  quiz: "Quiz signal",
} as const;

const TONE = {
  correct: "border-mastered-line bg-mastered-bg text-mastered-text",
  pass: "border-mastered-line bg-mastered-bg text-mastered-text",
  incorrect: "border-needswork-line bg-needswork-bg text-needswork-text",
  fail: "border-needswork-line bg-needswork-bg text-needswork-text",
  uncertain: "border-line bg-surface-hover text-ink-muted",
} as const;

export function EvidenceTrail({ rows }: { rows: EvidenceAttemptView[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Evidence trail" className="border-t border-line px-[18px] py-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Evidence trail</h3>
        <span className="text-[0.6875rem] text-ink-faint">{rows.length} {rows.length === 1 ? "event" : "events"} in this learning episode</span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row, i) => (
          <li key={row.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2.5 text-xs">
            <span className={cn("mt-1 flex size-4 items-center justify-center rounded-full border text-[0.5625rem] font-semibold", TONE[row.outcome])}>{i + 1}</span>
            <div className="min-w-0">
              <div className="font-semibold text-ink">{LABEL[row.kind]}</div>
              <div className="mt-0.5 line-clamp-2 text-ink-muted">{row.answer}</div>
              {row.evaluation?.misconceptionName && <div className="mt-0.5 text-needswork-text">Caught: {row.evaluation.misconceptionName}</div>}
            </div>
            <span className={cn("rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold capitalize", TONE[row.outcome])}>{row.outcome.replace("_", " ")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
