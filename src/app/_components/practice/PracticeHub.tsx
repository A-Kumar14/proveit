"use client";

import { useState } from "react";
import { Download, FileQuestion, FileText, ListChecks, LoaderCircle } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { PracticeResult } from "@proveit/lib/schemas";
import { buttonStyles } from "../Button";

type Run = { status: "idle" | "busy" | "done" | "error"; result?: PracticeResult; error?: string };

const link = "inline-flex items-center gap-1.5 rounded-sm border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 no-underline hover:bg-surface-hover";

function Tool({ icon: Icon, title, text, button, run, onRun, disabled }: {
  icon: typeof FileText; title: string; text: string; button: string; run: Run; onRun?: () => void; disabled?: string;
}) {
  const busy = run.status === "busy";
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-sm bg-surface-hover"><Icon size={16} strokeWidth={1.8} aria-hidden /></span>
        <h2 className="m-0 text-sm font-semibold">{title}</h2>
      </div>
      <p className="m-0 flex-1 text-[13px] leading-normal text-ink-muted">{text}</p>
      {run.status === "error" && <p role="alert" className="m-0 text-xs text-needswork-text">{run.error}</p>}
      {run.status === "done" && run.result && (
        <div className="flex flex-col gap-2">
          {run.result.pdfError && <p role="alert" className="m-0 text-xs text-developing-text">{run.result.pdfError} The .tex source is still below.</p>}
          {run.result.docs.map((d) => (
            <div key={d.name} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium">{d.label}</span>
              {d.pdf && <a className={link} download={`${d.name}.pdf`} href={`data:application/pdf;base64,${d.pdf}`}><Download size={12} aria-hidden />PDF</a>}
              <a className={link} download={`${d.name}.tex`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(d.tex)}`}><Download size={12} aria-hidden />.tex</a>
            </div>
          ))}
        </div>
      )}
      {disabled ? <span className="text-[11px] text-ink-faint">{disabled}</span> : (
        <button type="button" onClick={onRun} disabled={busy} className={cn(buttonStyles({ size: "sm" }), "w-fit cursor-pointer")}>
          {busy && <LoaderCircle size={13} className="animate-spin" aria-hidden />}
          {busy ? "Generating..." : run.status === "done" ? "Generate again" : button}
        </button>
      )}
    </section>
  );
}

export function PracticeHub({ courseId }: { courseId: string }) {
  const [paper, setPaper] = useState<Run>({ status: "idle" });
  const [notes, setNotes] = useState<Run>({ status: "idle" });
  const go = (set: (r: Run) => void, call: (id: string) => Promise<PracticeResult>) => async () => {
    set({ status: "busy" });
    try { set({ status: "done", result: await call(courseId) }); }
    catch (e) { set({ status: "error", error: e instanceof Error ? e.message : "Something went wrong. Retry." }); }
  };
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Tool icon={FileQuestion} title="Sample question paper" button="Generate paper" run={paper} onRun={go(setPaper, api.samplePaper)}
        text="A 10-question paper that leans on what you keep getting wrong. The answer key comes as a separate file." />
      <Tool icon={FileText} title="Notes" button="Generate notes" run={notes} onRun={go(setNotes, api.studyNotes)}
        text="Notes on the course, plus the mistakes you keep making and how to fix each one." />
      <Tool icon={ListChecks} title="Quiz" button="" run={{ status: "idle" }} disabled="Coming soon"
        text="A quick quiz you take in the app. Not built yet." />
    </div>
  );
}
