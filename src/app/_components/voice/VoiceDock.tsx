"use client";

import { Keyboard, Mic, MicOff } from "lucide-react";
import { cn } from "@proveit/lib/cn";

/** The bar that replaces the prompt box during a spoken conversation. Callers pass the buttons that apply to them. */
export function VoiceDock({ muted, onToggleMute, waving, status, actions, onExit }: {
  muted: boolean; onToggleMute: () => void; waving: boolean; status: React.ReactNode; actions?: React.ReactNode; onExit: () => void;
}) {
  return (
    <div className="shrink-0 px-4 lg:px-7 pb-[18px] pt-2">
      <div className="flex w-full max-w-[822px] items-center gap-3 rounded-[14px] border border-line-button bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]">
        <button type="button" onClick={onToggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted}
          className={cn("flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border", muted ? "border-needswork bg-needswork text-white" : "border-line bg-surface text-ink-3 hover:bg-surface-hover")}>
          {muted ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
        </button>
        <span aria-hidden className="flex h-4 w-6 shrink-0 items-center gap-[2px]">
          {[0, 0.15, 0.3, 0.45].map((d) => <span key={d} className={cn("h-4 w-[3px] rounded-[2px]", waving ? "wv bg-ink" : "scale-y-[0.3] bg-ink-faint")} style={{ animationDelay: `${d}s` }} />)}
        </span>
        <div className="min-w-0 flex-1 truncate text-sm" aria-live="polite">{status}</div>
        {actions}
        <button type="button" onClick={onExit} aria-label="Back to typing" title="Back to typing" className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-3 hover:bg-surface-hover"><Keyboard size={16} aria-hidden /></button>
      </div>
    </div>
  );
}
