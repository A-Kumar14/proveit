"use client";

import { ArrowUp } from "lucide-react";
import { buttonStyles } from "../Button";
import { cn } from "@proveit/lib/cn";

export type Status = "idle" | "evaluating" | "error";

/** ResponseBox. Pinned answer input. Only controls that work are rendered. */
export function Composer({ value, onChange, onSubmit, status, error, placeholder, submitLabel = "Submit", loadingText = "Checking your reasoning...", hint, leading, chip }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; status: Status; error?: string | null;
  placeholder: string; submitLabel?: string; loadingText?: string; hint?: string;
  /** Controls shown left of the submit button. Only pass ones that work. */
  leading?: React.ReactNode;
  /** Attached-file chip shown above the text box. */
  chip?: React.ReactNode;
}) {
  const busy = status === "evaluating";
  return (
    <div className="shrink-0 px-7 pb-[18px] pt-2">
      <div className={cn("flex flex-col gap-2 rounded-md border bg-surface px-3.5 pb-2 pt-2.5", error ? "border-needswork-line" : "border-line")}>
        {chip}
        <label htmlFor="answer" className="sr-only">Your answer</label>
        <textarea
          id="answer" rows={3} value={value} disabled={busy} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
          className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-[1.55] text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          {leading}
          <div className="min-w-0 flex-1 text-xs" aria-live="polite">
            {busy ? <span className="text-ink-muted">{loadingText}</span>
              : error ? <span className="text-needswork-text">{error}</span>
              : <span className="text-ink-faint">{hint ?? "Cmd + Enter to submit"}</span>}
          </div>
          <button type="button" onClick={onSubmit} disabled={busy || !value.trim()} className={cn(buttonStyles({ size: "md" }), "py-2")}>
            {status === "error" ? "Retry" : submitLabel}
            <ArrowUp size={13} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
