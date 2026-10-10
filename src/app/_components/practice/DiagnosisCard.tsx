import Link from "next/link";
import { buttonStyles } from "../Button";
import { AssistantCard, CalloutRow, Callout, CardFooter, CardTable, Cell, Row, Section } from "../chat/AssistantCard";
import { MasteryBar } from "../mastery/MasteryBar";
import { EvidenceHighlight } from "./EvidenceHighlight";
import { DiagnosisActions } from "./DiagnosisActions";
import { TONE, toneForPct } from "@proveit/lib/mastery";
import type { AttemptView } from "@proveit/server/store";
import { AlertTriangle } from "lucide-react";

const ERROR_LABEL = { none: "", conceptual: "conceptual error", procedural: "procedural error", slip: "calculation slip", interpretation: "interpretation error", flawed_reasoning: "flawed-reasoning answer", uncertain: "" } as const;
const STATUS = { good: "Mastered", warn: "Transfer pending", bad: "Reteaching", none: "No data" } as const;

export function DiagnosisCard({ a }: { a: AttemptView }) {
  const e = a.evaluation;
  const wrong = e.verdict === "incorrect";
  const meta = e.votes && (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="flex gap-[3px]">{Array.from({ length: e.votes.of }, (_, i) => <span key={i} className={`size-2 rounded-[2px] ${i < e.votes!.agree ? "bg-needswork" : "bg-surface-strong"}`} />)}</span>
      {e.votes.agree} of {e.votes.of} checks agree
    </span>
  );
  return (
    <AssistantCard
      ariaLabel="Diagnosis" edge={wrong ? "bad" : "good"} label="Diagnosis" meta={meta}
      headline={wrong ? `1 ${ERROR_LABEL[e.errorType]} found` : "No misconception found"}
    >
      <CardTable head={["SKILL", "LEVEL", "STATUS", "MISCONCEPTION"]}>
        {e.skills.map((s) => {
          const tone = toneForPct(s.pct);
          return (
            <Row key={s.label}>
              <Cell className="font-semibold">{s.label}</Cell>
              <Cell className="w-[170px]">
                <div className="flex items-center gap-2">
                  <MasteryBar pct={s.pct} barClass={TONE[tone].bar} label={`${s.label} ${s.pct}%`} />
                  <span className="w-8 text-right text-xs">{s.pct}%</span>
                </div>
              </Cell>
              <Cell><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[tone].pill}`}>{STATUS[tone]}</span></Cell>
              <Cell className={tone === "bad" && e.misconceptionName ? "text-ink-3" : "text-ink-faint"}>{tone === "bad" && e.misconceptionName ? e.misconceptionName : "None"}</Cell>
            </Row>
          );
        })}
      </CardTable>

      <CalloutRow>
        {wrong && (
          <Callout kind="risk" title="Where it broke" grow={1.3}>
            <div className="mb-2 leading-[1.7] text-ink-3"><EvidenceHighlight text={a.answer} quote={e.evidenceQuote} /></div>
            {e.gapSentence}
          </Callout>
        )}
        <Callout kind={wrong ? "advice" : "plain"} title="Recommendation">{e.recommendation}</Callout>
      </CalloutRow>

      <Section title="Next actions">
        {wrong
          ? <DiagnosisActions attemptId={a.id} lessonHref={`/course/${a.courseId}/lesson/${a.id}`} talkHref={`/course/${a.courseId}/practice/${a.conceptId}?mode=speak`} />
          : <div className="flex flex-wrap gap-2">
              <Link href={`/course/${a.courseId}/transfer/${a.id}`} className={buttonStyles()}>Prove it on a new question</Link>
              <Link href={`/course/${a.courseId}`} className={buttonStyles({ variant: "secondary" })}>Back to course map</Link>
            </div>}
      </Section>
      <CardFooter left="Levels come from your attempts." />
      {wrong && !e.evidenceQuote && (
        <div className="flex items-center gap-1.5 px-[18px] pb-3.5 text-[11px] text-ink-faint"><AlertTriangle size={12} aria-hidden />No single phrase stood out, so nothing is highlighted.</div>
      )}
    </AssistantCard>
  );
}
