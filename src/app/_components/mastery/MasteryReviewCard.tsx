"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { RefreshCw } from "lucide-react";
import { ReviewText } from "@proveit/lib/schemas";
import { TONE } from "@proveit/lib/mastery";
import type { ReviewBase } from "@proveit/server/store";
import { buttonStyles } from "../Button";
import { AssistantCard, CalloutRow, Callout, CardFooter, CardTable, Cell, Row, Section } from "../chat/AssistantCard";
import { Skeleton } from "../chat/Skeleton";
import { MasteryBar } from "./MasteryBar";
import { cn } from "@proveit/lib/cn";

const STATUS = {
  mastered: { label: "Mastered", tone: "good" },
  "transfer-pending": { label: "Transfer pending", tone: "warn" },
  reteaching: { label: "Reteaching", tone: "bad" },
} as const;

/** Computed fields render at once. Model text shows a skeleton until it streams in. */
export function MasteryReviewCard({ courseId, base, aiWritten }: { courseId: string; base: ReviewBase; aiWritten: boolean }) {
  const { object, submit, isLoading, error } = useObject({ api: "/api/mastery-review", schema: ReviewText });
  const run = () => submit({ courseId });
  // useObject returns a new submit each render, so depending on it would re-fire forever. Start once per mount.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    submit({ courseId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = (v: string | undefined) => (v ? v : isLoading ? <Skeleton /> : null);
  const misconceptionFor = (name: string) => object?.misconceptions?.find((m) => m?.concept === name)?.misconception;

  return (
    <AssistantCard
      ariaLabel="Mastery review" label="Mastery review · Intro Statistics" headline={base.headline}
      meta={
        <button type="button" onClick={run} disabled={isLoading} className={cn(buttonStyles({ variant: "secondary", size: "sm" }))}>
          <RefreshCw size={12} strokeWidth={2} aria-hidden />{isLoading ? "Writing..." : "Regenerate review"}
        </button>
      }
    >
      <CardTable head={["CONCEPT", "MASTERY", "STATUS", "MISCONCEPTION"]}>
        {base.concepts.map((c) => {
          const st = STATUS[c.status];
          const m = misconceptionFor(c.name);
          return (
            <Row key={c.name}>
              <Cell className="font-semibold">{c.name}</Cell>
              <Cell className="w-40">
                <div className="flex items-center gap-2">
                  <MasteryBar pct={c.mastery} barClass={TONE[st.tone].bar} label={`${c.name} ${c.mastery}%`} />
                  <span className="w-8 text-right text-xs">{c.mastery}%</span>
                </div>
              </Cell>
              <Cell><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TONE[st.tone].pill)}>{st.label}</span></Cell>
              <Cell className="w-44 text-ink-3">{c.status === "mastered" ? <span className="text-ink-faint">None</span> : m === undefined ? text(undefined) : m ?? <span className="text-ink-faint">None</span>}</Cell>
            </Row>
          );
        })}
      </CardTable>

      {error ? (
        <div role="alert" className="mx-[18px] my-3 rounded-sm border border-needswork-line bg-needswork-bg px-3 py-2 text-[13px] text-needswork-text">
          The review text failed to load. The numbers above are still correct.{" "}
          <button type="button" onClick={run} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] underline">Retry</button>
        </div>
      ) : (
        <CalloutRow>
          <Callout kind="risk" title="Biggest risk">{text(object?.biggestRisk?.reason)}</Callout>
          <Callout kind="advice" title="Recommendation">{text(object?.recommendation)}</Callout>
        </CalloutRow>
      )}

      <Section title="Next actions">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
          {(object?.nextActions ?? []).map((a, i) => <li key={i} className="rounded-sm border border-line bg-surface-subtle px-2.5 py-2"><span className="mr-2 text-[11px] text-ink-muted">{i + 1}</span>{a}</li>)}
          {!object?.nextActions?.length && isLoading && <li><Skeleton className="h-8" /></li>}
        </ul>
        {base.nextHref && <Link href={base.nextHref} className={cn(buttonStyles(), "mt-1 self-start")}>Start now</Link>}
      </Section>
      <CardFooter left="Numbers are computed from your attempts." right={aiWritten ? "Risk and advice written by AI" : undefined} />
    </AssistantCard>
  );
}
