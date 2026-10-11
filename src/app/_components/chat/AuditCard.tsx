import Link from "next/link";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { AuditResult } from "@proveit/lib/schemas";
import { buttonStyles } from "../Button";
import { cn } from "@proveit/lib/cn";
import { AssistantCard, Section } from "./AssistantCard";

const Quote = ({ children }: { children: React.ReactNode }) => <span className="italic text-ink">&ldquo;{children}&rdquo;</span>;

/** End of a spoken session. Right, off and not covered, each tied to the student's own words. */
export function AuditCard({ conceptName, audit, nextHref, onAgain }: { conceptName: string; audit: AuditResult; nextHref: string; onAgain: () => void }) {
  const empty = !audit.right.length && !audit.off.length;
  return (
    <AssistantCard
      ariaLabel="Audit" label={`Audit · ${conceptName}`} edge={audit.off.length ? "bad" : audit.verdict === "correct" ? "good" : "default"}
      headline={empty ? "I couldn't tell yet. Say more next time." : "Where you're right and where you're not"}
    >
      <div className="flex flex-col gap-3.5 pt-3.5">
        {audit.right.length > 0 && (
          <Section title="What you got right">
            {audit.right.map((r, i) => (
              <div key={i} className="flex gap-2 text-[0.8125rem] leading-normal text-ink-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mastered-text" aria-hidden /><span><Quote>{r.quote}</Quote>. {r.note}</span></div>
            ))}
          </Section>
        )}
        {audit.off.length > 0 && (
          <Section title="Where it's off">
            {audit.off.map((o, i) => (
              <div key={i} className="flex gap-2 rounded-sm border border-needswork-line bg-needswork-bg px-3 py-2.5 text-[0.8125rem] leading-normal text-ink-2">
                <XCircle size={15} className="mt-0.5 shrink-0 text-needswork-text" aria-hidden />
                <span><Quote>{o.quote}</Quote>. {o.note}<br /><span className="font-semibold">Instead:</span> {o.fix}</span>
              </div>
            ))}
          </Section>
        )}
        {audit.missing.length > 0 && (
          <Section title="Not covered">
            {audit.missing.map((m, i) => (
              <div key={i} className="flex gap-2 text-[0.8125rem] leading-normal text-ink-3"><CircleDashed size={15} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />{m}</div>
            ))}
          </Section>
        )}
      </div>
      <div className="flex gap-2 border-t border-line px-[18px] py-3">
        {audit.verdict !== "uncertain" && <Link href={nextHref} className={buttonStyles()}>{audit.off.length ? "Fix this gap" : "Test it on a new question"}</Link>}
        <button type="button" onClick={onAgain} className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer")}>Talk it through again</button>
      </div>
    </AssistantCard>
  );
}
