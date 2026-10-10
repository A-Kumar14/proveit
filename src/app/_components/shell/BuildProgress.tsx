"use client";

import { Check, Circle, FileText, LoaderCircle, X } from "lucide-react";
import type { CourseJobView } from "@proveit/lib/schemas";
import { cn } from "@proveit/lib/cn";

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** Where a course build is, stage by stage. The server decides the stages, this only shows them. */
export function BuildProgress({ job, onCancel }: { job: CourseJobView; onCancel?: () => void }) {
  const running = job.stage !== "done" && job.stage !== "failed" && job.stage !== "cancelled";
  return (
    <section aria-label="Building your course" className="flex flex-col gap-3 rounded-md border border-line bg-surface-subtle p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{job.stage === "done" ? `${job.name} is ready` : job.stage === "failed" ? "The build stopped" : job.stage === "cancelled" ? "Build cancelled" : `Building ${job.name}`}</div>
        <div className="text-xs tabular-nums text-ink-muted" aria-label="Time so far">{clock(job.elapsedMs)}</div>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Stages">
        {job.stages.map((s) => (
          <li key={s.id} aria-current={s.state === "active" ? "step" : undefined} className="flex flex-col gap-1">
            <div className={cn("flex items-center gap-2 text-[13px]", s.state === "waiting" ? "text-ink-faint" : s.state === "failed" ? "text-needswork-text" : "text-ink")}>
              {s.state === "done" ? <Check size={14} strokeWidth={2.4} className="text-mastered-text" aria-hidden />
                : s.state === "active" ? <LoaderCircle size={14} className="animate-spin" aria-hidden />
                : s.state === "failed" ? <X size={14} strokeWidth={2.4} aria-hidden />
                : <Circle size={14} aria-hidden />}
              <span className={s.state === "active" ? "font-semibold" : undefined}>{s.label}</span>
              <span className="sr-only">{s.state === "done" ? ", done" : s.state === "active" ? ", in progress" : s.state === "failed" ? ", stopped here" : ", waiting"}</span>
            </div>
            {s.id === "reading" && s.state !== "waiting" && job.files.length > 0 && (
              <ul className="m-0 ml-[22px] flex list-none flex-col gap-0.5 p-0">
                {job.files.map((f) => (
                  <li key={f.name} className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <FileText size={11} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className={cn("shrink-0", f.state === "failed" && "text-needswork-text")}>{f.state === "reading" ? "Reading..." : f.state === "waiting" ? "Waiting" : f.note ?? (f.state === "done" ? "Done" : "Failed")}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {job.error && <p role="alert" className="m-0 text-xs text-needswork-text">{job.error}</p>}
      {running && (
        <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
          <span>Typeset PDFs and notes are read in seconds. Scans and images take longer.</span>
          {onCancel && <button type="button" onClick={onCancel} className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs text-ink-muted underline hover:text-ink">Cancel</button>}
        </div>
      )}
    </section>
  );
}
