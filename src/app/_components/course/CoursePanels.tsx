import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { ConceptView, CourseFile, CourseView, MisconceptionEntry, ReviewBase } from "@proveit/server/store";
import { buttonStyles } from "../Button";
import { Widget } from "../dashboard/Widget";

export function TutorPanel({ courseId, review }: { courseId: string; review: ReviewBase }) {
  return (
    <Widget title="Tutor" action={{ label: "Full review", href: `/course/${courseId}/tutor` }}>
      <p className="m-0 text-[13px]">{review.fallback.recommendation}</p>
      <p className="m-0 text-xs text-ink-muted">{review.fallback.biggestRisk.reason}</p>
    </Widget>
  );
}

export function PracticePanel({ course, next }: { course: CourseView; next: ConceptView | null }) {
  const done = course.concepts.length > 0 && course.concepts.every((c) => c.state === "mastered");
  return (
    <Widget title="Practice">
      {next ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{next.name}</span>
              <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", LOOK[next.state].pill)}>{LOOK[next.state].label}</span>
            </div>
            <p className="m-0 mt-0.5 text-xs text-ink-muted">{next.desc}</p>
          </div>
          {next.cta.href ? <Link href={next.cta.href} className={buttonStyles({ size: "sm" })}>Start</Link> : <span className="text-[11px] text-ink-faint">Not in demo</span>}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-ink-muted">{done ? "Every concept in this course is mastered." : "This course can't be practiced in the demo yet."}</p>
      )}
    </Widget>
  );
}

export function MisconceptionPanel({ courseId, log }: { courseId: string; log: MisconceptionEntry[] }) {
  return (
    <Widget title="Misconception log" action={log.length > 0 ? { label: "Open log", href: `/course/${courseId}/misconceptions` } : undefined}>
      {log.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">Nothing caught yet. A specific mistake in an answer shows up here until a new question clears it.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {log.map((m) => (
            <li key={m.key} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{m.name}</div>
                <div className="text-[11px] text-ink-muted">{m.concept} · {m.note}</div>
              </div>
              <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold", m.open ? "bg-needswork-bg text-needswork-text" : "bg-mastered-bg text-mastered-text")}>{m.open ? "Open" : "Repaired"}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

export function FilesPanel({ courseId, files }: { courseId: string; files: CourseFile[] }) {
  return (
    <Widget title="Course files" action={{ label: "All files", href: `/course/${courseId}/files` }}>
      {files.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No files for this course yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {files.map((f) => (
            <li key={f.name} className="flex items-start gap-2">
              <FileText size={15} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{f.name}</div>
                <div className="text-[11px] text-ink-muted">{f.kind}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
