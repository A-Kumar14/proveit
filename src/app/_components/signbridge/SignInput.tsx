"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { RecognizedSignKind } from "@proveit/lib/signbridgeText";
import { SignBridgeDemo } from "./SignBridgeDemo";

export function SignInput({ onRecognizedText, onClose }: {
  onRecognizedText: (text: string, kind: RecognizedSignKind, startsTranscript: boolean) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label="ASL Assistant panel" className="glass fixed inset-y-4 right-4 z-[60] flex w-[min(50vw,560px)] min-w-0 flex-col overflow-y-auto rounded-2xl border border-line bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.2)] max-[640px]:w-[calc(100vw-2rem)]">
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">ASL Assistant</div>
          <p className="m-0 mt-0.5 text-xs text-ink-muted">Recognized text is added to your draft for review.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close ASL Assistant" title="Close ASL Assistant" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-3 hover:bg-surface-hover">
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <SignBridgeDemo compact autoStart onRecognizedText={onRecognizedText} />
      </div>
    </aside>
  );
}
