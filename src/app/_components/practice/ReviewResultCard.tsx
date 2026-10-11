import { AssessmentScore } from "./AssessmentScore";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "../Button";
import { AssistantCard, Callout, CalloutRow, CardFooter, CardTable, Cell, Row, Section } from "../chat/AssistantCard";
import { StatusPill } from "../mastery/StatusPill";
import type { ReviewResultView } from "@proveit/server/store";

export function ReviewResultCard({ r }: { r: ReviewResultView }) {
  const promoted = r.previous === "provisional";
  return (
    <AssistantCard
      ariaLabel="Review passed"
      edge="good"
      label="Delayed review passed"
      headline={promoted ? "Mastered. You still had it." : "Still retained."}
      meta={
        <span className="flex items-center gap-2">
          <StatusPill state={r.previous} className="px-[9px]" />
          <ArrowRight size={14} strokeWidth={2} className="text-ink-muted" aria-hidden />
          <StatusPill state="mastered" className="px-[9px]" />
        </span>
      }
    >
      <CardTable head={["EVIDENCE", "RESULT"]}>
        <Row><Cell className="text-ink-3">Delayed retrieval</Cell><Cell className="font-semibold text-mastered-text">Passed</Cell></Row>
        <Row><Cell className="text-ink-3">Mastery status</Cell><Cell className="font-semibold">{promoted ? "Promoted to Mastered" : "Mastered retained"}</Cell></Row>
        <Row><Cell className="text-ink-3">Rank points earned</Cell><Cell className="font-semibold tabular-nums">+{r.pointsEarned}</Cell></Row>
        <Row><Cell className="text-ink-3">{r.courseName}</Cell><Cell className="font-semibold">{r.provenLabel} · {r.coursePct}%</Cell></Row>
      </CardTable>

      <AssessmentScore reward={r.assessmentReward} />
      <CalloutRow>
        <Callout kind="plain" title="Next spaced review"><div className="text-[0.9375rem] font-semibold text-ink">{r.nextReview}</div><div className="text-xs text-ink-muted">The interval expands after successful delayed checks.</div></Callout>
        <Callout kind="advice" title="Why this matters">You proved the idea after time passed, not while the explanation was still fresh.</Callout>
      </CalloutRow>

      <Section title="Next actions">
        <div className="flex flex-wrap gap-2">
          <Link href="/review" className={buttonStyles()}>Back to review queue</Link>
          <Link href={`/course/${r.courseId}`} className={buttonStyles({ variant: "secondary" })}>Open course</Link>
          <Link href="/" className={buttonStyles({ variant: "secondary" })}>Dashboard</Link>
        </div>
      </Section>
      <CardFooter left="Mastered means you showed it again after a delay. Future spaced reviews can confirm it sticks." />
    </AssistantCard>
  );
}

