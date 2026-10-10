import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { QuizResult } from "@proveit/lib/schemas";
import { buttonStyles } from "../Button";

const LETTERS = ["A", "B", "C", "D"];

/** A finished quiz: the score, what it did to the course map and rank, where you're strong and weak, and every answer. */
export function QuizResultView({ result, onRetake, saved = true }: { result: QuizResult; onRetake?: () => void; saved?: boolean }) {
  const strong = result.byConcept.filter((c) => c.right === c.total);
  const weak = result.byConcept.filter((c) => c.right < c.total).sort((a, b) => a.right / a.total - b.right / b.total);
  return (
    <section aria-label="Quiz results" className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
        <div className="eyebrow">Your score</div>
        <div className="flex items-baseline gap-3"><span className="text-[32px] font-semibold leading-none tabular-nums">{result.score} / {result.total}</span><span className="text-sm text-ink-muted">{result.pct}%</span></div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="By concept">
          {result.byConcept.map((c) => (
            <li key={c.conceptId} className="flex items-center gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{c.concept}</span>
              <span className="tabular-nums text-ink-muted">{c.right} of {c.total}</span>
              <span className="h-1.5 w-24 rounded-full bg-surface-active"><span className={cn("block h-full rounded-full", c.right === c.total ? "bg-mastered" : c.right === 0 ? "bg-needswork" : "bg-developing")} style={{ width: `${Math.round((c.right / c.total) * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
      </div>

      <section aria-label="What this quiz changed" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
        <h2 className="m-0 text-sm font-semibold">What this quiz changed</h2>
        {result.changes.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {result.changes.map((c) => (
              <li key={c.conceptId} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1">{c.concept}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", LOOK[c.from].pill)}>{LOOK[c.from].label}</span>
                <ArrowRight size={12} className="text-ink-faint" aria-label="became" />
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", LOOK[c.to].pill)}>{LOOK[c.to].label}</span>
              </li>
            ))}
          </ul>
        ) : <p className="m-0 text-[13px] text-ink-muted">No concept changed state. A quiz can start a concept or flag one that is going badly. Proving a concept takes a new-question test.</p>}
        <p className="m-0 text-[13px]">{result.pointsGained > 0 ? <><span className="font-semibold text-mastered-text">+{result.pointsGained} rank points</span> for concepts you got right for the first time.</> : "No new rank points. Points go to each concept the first time you answer it right in a quiz."}</p>
        {saved && <p className="m-0 text-xs text-ink-faint">Saved to your <Link href="/history" className="text-ink-muted">History</Link>. You can open this review again from there.</p>}
      </section>

      <section aria-label="Where you stand" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-md border border-mastered-line bg-mastered-bg p-4">
          <h3 className="m-0 text-[11px] font-medium tracking-[0.06em] text-mastered-text uppercase">Solid in this quiz</h3>
          {strong.length ? <ul className="m-0 list-disc pl-4 text-[13px]">{strong.map((c) => <li key={c.conceptId}>{c.concept}</li>)}</ul> : <p className="m-0 text-[13px] text-ink-muted">Nothing fully right yet.</p>}
        </div>
        <div className="flex flex-col gap-1.5 rounded-md border border-needswork-line bg-needswork-bg p-4">
          <h3 className="m-0 text-[11px] font-medium tracking-[0.06em] text-needswork-text uppercase">Work on these</h3>
          {weak.length ? <ul className="m-0 list-disc pl-4 text-[13px]">{weak.map((c) => <li key={c.conceptId}>{c.concept}, {c.right} of {c.total} right</li>)}</ul> : <p className="m-0 text-[13px] text-ink-muted">Nothing missed.</p>}
        </div>
      </section>

      <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Review">
        {result.items.map((it, i) => {
          const right = it.picked === it.correct;
          return (
            <li key={`${it.id}-${i}`} className={cn("flex flex-col gap-2 rounded-md border bg-surface p-4", right ? "border-mastered-line" : "border-needswork-line")}>
              <div className="flex items-start gap-2">
                {right ? <Check size={16} className="mt-0.5 shrink-0 text-mastered-text" aria-label="Correct" /> : <X size={16} className="mt-0.5 shrink-0 text-needswork-text" aria-label="Incorrect" />}
                <div className="min-w-0"><div className="text-[11px] text-ink-faint">{i + 1}. {it.concept}</div><div className="text-sm font-semibold leading-normal">{it.prompt}</div></div>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                {it.options.map((o, j) => (
                  <li key={j} className={cn("rounded-sm px-2.5 py-1.5", j === it.correct ? "bg-mastered-bg text-mastered-text" : j === it.picked ? "bg-needswork-bg text-needswork-text" : "text-ink-muted")}>
                    <span className="mr-2 font-semibold">{LETTERS[j]}</span>{o}{j === it.correct && <span className="ml-2 text-[11px] font-semibold">Correct answer</span>}{j === it.picked && j !== it.correct && <span className="ml-2 text-[11px] font-semibold">Your answer</span>}
                  </li>
                ))}
              </ul>
              {it.picked === null && <p className="m-0 text-xs text-ink-faint">You left this one blank.</p>}
              <p className="m-0 text-xs leading-normal text-ink-muted">{it.explanation}</p>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {onRetake
          ? <button type="button" onClick={onRetake} className={cn(buttonStyles(), "cursor-pointer")}>New quiz</button>
          : <Link href={`/course/${result.courseId}/practice/quiz`} className={buttonStyles()}>Take another quiz</Link>}
        <Link href={`/course/${result.courseId}`} className={buttonStyles({ variant: "secondary" })}>See the course map</Link>
        <Link href={`/course/${result.courseId}/tutor`} className={buttonStyles({ variant: "secondary" })}>Ask the tutor about it</Link>
      </div>
    </section>
  );
}
