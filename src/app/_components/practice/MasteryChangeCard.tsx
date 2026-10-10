import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "../Button";
import { AssistantCard, CalloutRow, Callout, CardFooter, CardTable, Cell, Row, Section } from "../chat/AssistantCard";
import { StatusPill } from "../mastery/StatusPill";
import { cn } from "@proveit/lib/cn";
import type { MasteryState } from "@proveit/lib/schemas";
import type { ResultView } from "@proveit/server/store";

const SEG: Record<MasteryState, string> = {
  mastered: "bg-mastered", provisional: "bg-mastered-bg outline outline-1 outline-dashed outline-mastered", developing: "bg-developing", needs_work: "bg-needswork", not_started: "bg-surface-active",
};

export function MasteryChangeCard({ r }: { r: ResultView }) {
  const count = (s: MasteryState) => r.segments.filter((x) => x === s).length;
  return (
    <AssistantCard
      ariaLabel="Mastery updated" edge="good" label="Mastery updated" headline="Correct. That one stuck."
      meta={
        <span className="flex items-center gap-2">
          <StatusPill state={r.previous} className="px-[9px] line-through" />
          <ArrowRight size={14} strokeWidth={2} className="text-ink-muted" aria-hidden />
          <StatusPill state={r.next} label={r.next === "provisional" ? "Provisionally mastered" : undefined} className="px-[9px]" />
        </span>
      }
    >
      <CardTable head={["STEP", "RESULT"]}>
        <Row><Cell className="text-ink-3">Misconception found</Cell><Cell className="font-semibold">{r.misconception}</Cell></Row>
        <Row><Cell className="text-ink-3">Fixed with</Cell><Cell className="font-semibold">{r.intervention}</Cell></Row>
        <Row><Cell className="text-ink-3">New question, different setup</Cell><Cell className="font-semibold text-mastered-text">{r.transferText}</Cell></Row>
        <Row>
          <Cell className="text-ink-3">{r.courseName}</Cell>
          <Cell>
            <div className="flex items-center gap-2.5">
              <div role="img" aria-label={`${count("mastered")} proven, ${count("provisional")} provisional, ${count("developing")} developing, ${count("needs_work")} needs work, ${count("not_started")} not started`} className="grid h-2 w-[200px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${r.segments.length}, minmax(0, 1fr))` }}>
                {r.segments.map((s, i) => <div key={i} className={cn("rounded-[2px]", SEG[s])} />)}
              </div>
              <span className="text-xs text-ink-muted">{r.provenLabel}</span>
            </div>
          </Cell>
        </Row>
      </CardTable>

      <CalloutRow>
        <Callout kind="plain" title="Next review"><div className="text-[15px] font-semibold text-ink">{r.nextReview}</div><div className="text-xs text-ink-muted">Pass a quick check and it becomes Mastered.</div></Callout>
        <Callout kind="advice" title="Recommendation">{r.recommendation}</Callout>
      </CalloutRow>

      <Section title="Next actions">
        <div className="flex flex-wrap gap-2">
          {r.nextConcept && <Link href={r.nextConcept.href} className={buttonStyles()}>Keep going: {r.nextConcept.name}</Link>}
          <Link href={`/course/${r.courseId}`} className={buttonStyles({ variant: "secondary" })}>Back to course</Link>
          <Link href="/" className={buttonStyles({ variant: "secondary" })}>Go to dashboard</Link>
        </div>
      </Section>
      <CardFooter left="Status changes come from your answers, not from AI judgment alone. Provisional until the review passes." />
    </AssistantCard>
  );
}
