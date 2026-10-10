"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { cn } from "@proveit/lib/cn";

export type Status = "idle" | "evaluating" | "error";

/** Pill that opens voice mode. Same three-bar wave as the header action. */
function TalkPill({ onClick, unavailable }: { onClick: () => void; unavailable: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={unavailable} title={unavailable ? "Voice needs Chrome, Edge or Safari with a microphone" : undefined} className="disabled:cursor-not-allowed disabled:opacity-50 flex h-9 items-center gap-2 cursor-pointer rounded-full border border-line-button bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-hover">
      <span aria-hidden className="flex h-3.5 items-center gap-[2px]">{[0, 0.15, 0.3].map((d) => <span key={d} className="wv h-3.5 w-[3px] rounded-[2px] bg-ink" style={{ animationDelay: `${d}s` }} />)}</span>
      Talk it through
    </button>
  );
}

/** ResponseBox. Pinned answer input. Only controls that work are rendered. */
export function Composer({ value, onChange, onSubmit, status, error, placeholder, submitLabel = "Submit", loadingText = "Checking your reasoning...", hint, leading, chip, onTalk, talkUnavailable }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; status: Status; error?: string | null;
  placeholder: string; submitLabel?: string; loadingText?: string; hint?: string;
  /** Controls shown left of the status line. Only pass ones that work. */
  leading?: React.ReactNode;
  /** Attached-file chip shown above the text box. */
  chip?: React.ReactNode;
  /** When set, a "Talk it through" pill starts a spoken session. Pass only where the browser can transcribe. */
  onTalk?: () => void;
  /** Show the pill disabled when the browser can't transcribe speech, instead of hiding it. */
  talkUnavailable?: boolean;
}) {
  const busy = status === "evaluating";
  const box = useRef<HTMLTextAreaElement>(null);
  const canSend = !busy && !!value.trim();

  // Grow with the text up to 180px, then scroll.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  return (
    <div className="shrink-0 px-7 pb-[18px] pt-2">
      <div className="w-full max-w-[822px]">
        <div className={cn(
          "flex flex-col gap-2 rounded-[14px] border bg-surface px-3.5 pb-3 pt-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] transition-colors focus-within:border-ink-faint",
          error ? "border-needswork-line" : "border-line-button",
        )}>
          {chip}
          <label htmlFor="answer" className="sr-only">Your answer</label>
          <textarea
            ref={box} id="answer" rows={2} value={value} disabled={busy} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
            className="w-full resize-none border-0 bg-transparent px-0.5 text-sm leading-[1.6] text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
          />
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">{leading}</div>
            <div className="min-w-0 flex-1 truncate px-1 text-right text-xs" aria-live="polite">
              {busy ? <span className="text-ink-muted">{loadingText}</span>
                : error ? <span className="text-needswork-text">{error}</span>
                : <span className="text-ink-faint">{hint ?? "Cmd + Enter to send"}</span>}
            </div>
            {onTalk && !busy && <TalkPill onClick={onTalk} unavailable={!!talkUnavailable} />}
            <button
              type="button" onClick={onSubmit} disabled={!canSend}
              aria-label={status === "error" ? "Retry" : submitLabel}
              title={status === "error" ? "Retry" : submitLabel}
              className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition-colors disabled:cursor-not-allowed",
                canSend ? "bg-ink text-white hover:bg-ink-3" : "bg-surface-strong text-ink-faint")}
            >
              {busy ? <LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" aria-hidden /> : <ArrowUp size={16} strokeWidth={2.4} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
