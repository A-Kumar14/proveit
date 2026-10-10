import Link from "next/link";
import type { DashboardView } from "@proveit/server/store";
import { ActionList } from "../chat/ActionList";
import { AssistantCard, CalloutRow, Callout, CardFooter, CardTable, Cell, Row, Section } from "../chat/AssistantCard";
import { MasteryBar } from "./MasteryBar";
import { Check, AlertTriangle } from "lucide-react";

/** Dashboard "Today" card. Numbers are computed from attempts in code; risk and advice text comes from the backend. */
export function ReviewCard({ d }: { d: DashboardView }) {
  const parts = [
    <span key="p">{d.counts.proven} concepts proven</span>,
    d.counts.due > 0 && <span key="d" className="text-developing-text">{d.counts.due} due for review</span>,
    d.counts.needsWork > 0 && <span key="n">{d.counts.needsWork} needs work</span>,
  ].filter(Boolean);
  return (
    <AssistantCard
      ariaLabel="Today's review" label="Today · all courses"
      headline={parts.map((p, i) => <span key={i}>{i > 0 && ", "}{p}</span>)}
      meta={`${d.counts.courses} ${d.counts.courses === 1 ? "course" : "courses"}`}
    >
      <CardTable head={["COURSE", "MASTERY", "PROVEN", "OPEN MISCONCEPTION"]}>
        {d.courses.map((c) => (
          <Row key={c.id}>
            <Cell><Link href={`/course/${c.id}`} className="font-semibold text-ink no-underline hover:underline">{c.name}</Link></Cell>
            <Cell className="w-40">
              <div className="flex items-center gap-2">
                <MasteryBar pct={c.pct} barClass={c.pct >= 40 ? "bg-mastered" : "bg-developing"} label={`${c.name} mastery ${c.pct}%`} />
                <span className="w-8 text-right text-xs">{c.pct}%</span>
              </div>
            </Cell>
            <Cell className="text-ink-3">{c.proven} / {c.total}</Cell>
            <Cell className={c.openMisconception ? "text-needswork-text" : "text-ink-faint"}>
              {c.openMisconception ? <span className="inline-flex items-center gap-1"><AlertTriangle size={12} aria-hidden />{c.openMisconception}</span> : "None"}
            </Cell>
          </Row>
        ))}
      </CardTable>

      <CalloutRow>
        {d.risk ? <Callout kind="risk" title="Biggest risk"><b className="font-semibold">{d.risk.concept}.</b> {d.risk.reason}</Callout>
          : <Callout kind="plain" title="Biggest risk">No open misconceptions right now.</Callout>}
        <Callout kind="advice" title="Recommendation">{d.recommendation}</Callout>
      </CalloutRow>

      {d.recentlyCaught.length > 0 && (
        <Section title="Recently caught">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {d.recentlyCaught.map((r) => (
              <li key={r.concept} className="flex items-center gap-2">
                {r.repaired ? <Check size={13} strokeWidth={2.4} className="text-mastered-text" aria-hidden /> : <AlertTriangle size={13} className="text-needswork-text" aria-hidden />}
                <span>{r.misconception}</span>
                <span className="text-ink-faint">· {r.concept}</span>
                <span className={r.repaired ? "text-mastered-text" : "text-needswork-text"}>{r.repaired ? "Repaired" : "Still open"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Next actions">
        {d.nextActions.length > 0 ? <ActionList items={d.nextActions} /> : <div className="text-[13px] text-ink-muted">Nothing to do right now. Check back after your next review date.</div>}
      </Section>
      <CardFooter left="Numbers are computed from your attempts." />
    </AssistantCard>
  );
}
