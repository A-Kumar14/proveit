"use client";

import { useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { pauseReading, readPageOrSelection, resumeReading, selectedRange, stopReading, useReadAloudSupport, useReadState } from "./readAloud";

const button = "flex cursor-pointer items-center gap-1.5 rounded-sm border border-line-button bg-surface px-3 py-2 text-[0.8125rem] font-semibold text-ink hover:bg-surface-hover";

/**
 * The floating read-aloud control, shown on every page when the setting is on. It reads the selection if there
 * is one, otherwise the page. Pressing it must not clear the selection, so pointer-down is cancelled.
 */
export function ReadAloudControl({ rate }: { rate: number }) {
  const state = useReadState();
  const supported = useReadAloudSupport();
  const [message, setMessage] = useState("");
  if (!supported) return null;
  const keepSelection = (e: React.PointerEvent) => e.preventDefault();
  const start = () => {
    const what = selectedRange() ? "your selection" : "this page";
    setMessage(readPageOrSelection(rate) ? `Reading ${what}.` : "There's no text to read here.");
  };
  return (
    <div data-read-aloud-skip role="region" aria-label="Read aloud" className="fixed right-5 bottom-5 z-[80] flex items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
      {state === "idle" && (
        <button type="button" className={button} onPointerDown={keepSelection} onClick={start} title="Reads your selection, or the whole page">
          <Volume2 size={15} strokeWidth={2} aria-hidden />Read aloud
        </button>
      )}
      {state === "playing" && (
        <button type="button" className={button} onPointerDown={keepSelection} onClick={pauseReading}><Pause size={14} strokeWidth={2.2} aria-hidden />Pause</button>
      )}
      {state === "paused" && (
        <button type="button" className={button} onPointerDown={keepSelection} onClick={resumeReading}><Play size={14} strokeWidth={2.2} aria-hidden />Resume</button>
      )}
      {state !== "idle" && (
        <button type="button" className={cn(button, "px-2.5")} onPointerDown={keepSelection} onClick={() => { stopReading(); setMessage("Stopped reading."); }} aria-label="Stop reading">
          <Square size={13} strokeWidth={2.4} aria-hidden />
        </button>
      )}
      <span className="sr-only" role="status">{message}</span>
    </div>
  );
}
