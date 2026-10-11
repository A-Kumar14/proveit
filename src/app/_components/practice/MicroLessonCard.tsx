import { AssistantCard } from "../chat/AssistantCard";
import { CiIntervalsFigure } from "./CiIntervalsFigure";
import Link from "next/link";
import { Button, buttonStyles } from "../Button";
import type { RemediationView } from "@proveit/server/store";

export function MicroLessonCard({ lesson, conceptName, open, toggleable, onToggle, onGotIt, talkHref }: {
  lesson: RemediationView["lesson"]; conceptName: string; open: boolean; toggleable: boolean; onToggle: () => void; onGotIt?: () => void; talkHref?: string;
}) {
  return (
    <AssistantCard
      ariaLabel="Quick lesson" label={`Quick lesson · ${conceptName}`} headline={lesson.title}
      meta={toggleable && <button type="button" onClick={onToggle} className="cursor-pointer border-0 bg-transparent p-1 text-xs text-ink-muted">{open ? "Hide lesson" : "Show lesson"}</button>}
    >
      {open && (
        <>
          <div className="flex gap-3 px-[18px] py-3">
            <div className="flex flex-1 flex-col gap-2.5">
              <div className="rounded-sm border border-needswork-line bg-needswork-bg px-3 py-2.5">
                <div className="text-[0.6875rem] font-semibold text-needswork-text">What you said</div>
                <div className="mt-[3px] text-[0.8125rem] leading-normal text-ink-2">&ldquo;{lesson.said}&rdquo;</div>
              </div>
              <div className="rounded-sm border border-mastered-line bg-mastered-bg px-3 py-2.5">
                <div className="text-[0.6875rem] font-semibold text-mastered-text">What&apos;s actually true</div>
                <div className="mt-[3px] text-[0.8125rem] leading-normal text-ink-2">{lesson.actuallyTrue}</div>
              </div>
              <div className="text-xs leading-[1.55] text-ink-3">{lesson.explanation}</div>
            </div>
            {lesson.figure === "ci-intervals" && <CiIntervalsFigure />}
          </div>
          <div className="flex items-center justify-between gap-2.5 px-[18px] pb-3">
            <div className="flex gap-1.5">
              {lesson.rule && <span className="rounded-full bg-surface-active px-[9px] py-0.5 text-[0.6875rem] text-ink-3">{lesson.rule}</span>}
              {lesson.aiWording && <span className="rounded-full bg-developing-bg px-[9px] py-0.5 text-[0.6875rem] text-developing-text">Wording by AI</span>}
            </div>
            {onGotIt && (
              <div className="flex gap-2">
                {talkHref && <Link href={talkHref} className={buttonStyles({ variant: "secondary", size: "sm" })}>Still confused? Talk it through</Link>}
                <Button onClick={onGotIt} size="sm" className="py-[7px] text-xs">Got it, give me a new question</Button>
              </div>
            )}
          </div>
        </>
      )}
    </AssistantCard>
  );
}
