import { FileText } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import type { CourseFile, MisconceptionEntry, ReviewBase } from "@proveit/server/store";
import { Widget } from "../dashboard/Widget";

export function TutorPanel({ courseId, review }: { courseId: string; review: ReviewBase }) {
  return (
    <Widget title="Tutor" action={{ label: "Full review", href: `/course/${courseId}/tutor` }}>
      <p className="m-0 text-[13px]">{review.fallback.recommendation}</p>
      <p className="m-0 text-xs text-ink-muted">{review.fallback.biggestRisk.reason}</p>
    </Widget>
  );
}

export function PracticePanel({ courseId }: { courseId: string }) {
  return (
    <Widget title="Practice" action={{ label: "Open practice", href: `/course/${courseId}/practice` }}>
      <p className="m-0 text-[13px]">Sample question paper, notes and a quiz built from what you keep getting wrong.</p>
      <p className="m-0 text-xs text-ink-muted">To be tested on one concept, use Test this concept on the map above.</p>
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
