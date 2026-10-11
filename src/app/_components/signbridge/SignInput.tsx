"use client";

import { useEffect } from "react";
import { Camera, Delete, LoaderCircle, Space, X } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";
import { useSignSpelling } from "./useSignSpelling";

/**
 * Spell a word with your hands and drop it into the message box. The letters show before anything is sent,
 * so a misread can be fixed with Backspace. Nothing is sent to the tutor until "Use this" is tapped.
 */
export function SignInput({ onUse, onClose }: { onUse: (text: string) => void; onClose: () => void }) {
  const s = useSignSpelling();
  const { videoRef, overlayRef, captureRef, tracking } = s;
  const live = s.state === "live";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function use() {
    const text = s.letters.trim();
    if (!text) return;
    onUse(text);
    s.clear();
  }

  return (
    <section aria-label="Sign your message" className="glass mx-auto mb-2 flex w-full max-w-[822px] flex-col gap-3 rounded-[14px] border p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className={cn("size-2 shrink-0 rounded-full", live ? "bg-mastered" : "bg-ink-faint")} aria-hidden />
          <span className="shrink-0 font-semibold">Sign</span>
          <span role="status" className="truncate text-ink-muted">{s.status}</span>
        </div>
        <button type="button" onClick={() => { s.stop(); onClose(); }} aria-label="Close sign input" className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-muted hover:bg-surface-hover"><X size={15} aria-hidden /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-line bg-[#17191d]">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 block h-full w-full -scale-x-100 object-cover" aria-label="Camera preview" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" aria-hidden />
          <canvas ref={captureRef} className="hidden" aria-hidden />
          {!live && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button type="button" onClick={() => void s.start()} disabled={s.state === "starting"} className={cn(buttonStyles({ size: "sm" }), "cursor-pointer")}>
                {s.state === "starting" ? <LoaderCircle size={13} className="animate-spin" aria-hidden /> : <Camera size={13} aria-hidden />}
                {s.state === "starting" ? "Starting" : "Start camera"}
              </button>
            </div>
          )}
          {live && tracking && (
            <div aria-hidden className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
              <span className="font-semibold">{tracking.label}</span>
              <span className="flex gap-[2px]">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("size-1.5 rounded-full", i < tracking.frames ? "bg-white" : "bg-white/30")} />)}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-3">
          <div aria-label="Letters so far" aria-live="polite" className="flex min-h-[52px] flex-wrap content-start gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-2">
            {s.letters ? [...s.letters].map((ch, i) => (
              <span key={i} className={cn("flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-base font-semibold", ch === " " ? "w-4 bg-transparent" : "bg-surface-active")}>{ch === " " ? "" : ch}</span>
            )) : <span className="self-center text-[0.8125rem] text-ink-faint">Hold an ASL letter steady and it lands here. Hold four frames per letter.</span>}
          </div>
          {s.error && <p role="alert" className="m-0 text-xs text-needswork-text">{s.error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={s.space} disabled={!s.letters} className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "cursor-pointer")}><Space size={13} aria-hidden />Space</button>
            <button type="button" onClick={s.backspace} disabled={!s.letters} className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "cursor-pointer")}><Delete size={13} aria-hidden />Backspace</button>
            <button type="button" onClick={s.clear} disabled={!s.letters} className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "cursor-pointer")}>Clear</button>
            <button type="button" onClick={use} disabled={!s.letters.trim()} className={cn(buttonStyles({ size: "sm" }), "ml-auto cursor-pointer bg-ink text-white hover:bg-ink-3")}>Use this</button>
          </div>
        </div>
      </div>
    </section>
  );
}
