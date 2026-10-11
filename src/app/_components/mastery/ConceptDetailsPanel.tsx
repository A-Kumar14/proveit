import { assessmentLevel } from "@proveit/lib/rewards";
import Link from "next/link";
import { buttonStyles } from "../Button";
import { cn } from "@proveit/lib/cn";
import { LOOK, TONE } from "@proveit/lib/mastery";
import type { ConceptView } from "@proveit/server/store";
import { MasteryBar } from "./MasteryBar";

export function ConceptDetailsPanel({ c }: { c: ConceptView }) {
  return (
    <section aria-label="Selected concept" className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[0.625rem] tracking-[0.06em] text-ink-faint">{c.unit}</div>
        <span className={cn("whitespace-nowrap rounded-full px-[9px] py-0.5 text-[0.6875rem] font-semibold", LOOK[c.state].chip)}>{LOOK[c.state].label}</span>
      </div>
      <div className="text-base font-semibold">{c.name}</div>
      <div className="text-xs leading-normal text-ink-muted">{c.desc}</div>
      {c.rewards && <div className="rounded border border-line p-2 text-xs text-ink-muted" aria-label="Topic point allocation">
        <p className="m-0">Importance: {c.rewards.weight === 3 ? "Core" : c.rewards.weight === 1 ? "Supporting" : "Important"}</p>
        <p className="m-0">Quiz: {Math.floor(c.rewards.quiz * c.rewards.quizCoverage / 4)} / {c.rewards.quiz} points · Explanation: {c.rewards.explanationEarned ? c.rewards.explanation : 0} / {c.rewards.explanation} points</p>
        {c.rewards.quizBest !== null && <p className="m-0">Best quiz assessment: {Math.floor(c.rewards.quizBest * 10) / 10}% · {assessmentLevel(c.rewards.quizBest)}</p>}
        {c.rewards.explanationBest !== null && <p className="m-0">Best explanation: {Math.floor(c.rewards.explanationBest * 10) / 10}% · {assessmentLevel(c.rewards.explanationBest)}</p>}
      </div>}
      {c.dims.map((d) => (
        <div key={d.label} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-ink-muted">{d.label}</span>
            <span className={cn("text-[0.6875rem]", TONE[d.tone].text)}>{d.level}</span>
          </div>
          <MasteryBar pct={d.pct} barClass={TONE[d.tone].bar} label={`${d.label} ${d.level}`} className="h-[5px] flex-none" />
        </div>
      ))}
      <div className="text-xs text-ink-3"><span className="text-ink-faint">Evidence:</span> {c.evidence}</div>
      {c.cta.href
        ? <Link href={c.cta.href} className={cn(buttonStyles(), "mt-auto")}>{c.cta.label}</Link>
        : <span className={cn(buttonStyles({ variant: "secondary" }), "mt-auto cursor-not-allowed opacity-60")} aria-disabled>{c.cta.label}</span>}
    </section>
  );
}

