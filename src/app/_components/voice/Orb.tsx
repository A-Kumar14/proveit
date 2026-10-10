import { Mic } from "lucide-react";
import { cn } from "@proveit/lib/cn";

export type OrbState = "listening" | "tutor" | "muted";

export function Orb({ state, size, label, onClick }: { state: OrbState; size: number; label: string; onClick: () => void }) {
  const ring = "absolute inset-0 rounded-full";
  return (
    <button type="button" aria-label={label} onClick={onClick} style={{ width: size, height: size }} className="relative flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 transition-[width,height] duration-300">
      {state === "listening" && (<><span className={cn(ring, "rp border-2 border-line-soft")} /><span className={cn(ring, "rp2 border-2 border-line-soft")} /></>)}
      {state === "tutor" && (<><span className={cn(ring, "border border-[#EDEDED] bg-[#EDEDED]")} /><span className={cn(ring, "inset-[12%] bg-[#EDEDED]")} /></>)}
      {state === "muted" && (<><span className={cn(ring, "border border-line")} /><span className={cn(ring, "inset-[14%] border border-line")} /></>)}
      <span className={cn("relative flex size-[52%] items-center justify-center rounded-full transition-colors duration-300", state === "muted" ? "bg-[#F2F2F2]" : "bg-ink")}>
        {state === "tutor" ? (
          <span aria-hidden className="flex h-10 items-center gap-1">
            {[0, 0.12, 0.24, 0.36, 0.48].map((d) => <span key={d} className="wv h-10 w-[5px] rounded-[3px] bg-white" style={{ animationDelay: `${d}s` }} />)}
          </span>
        ) : (
          <Mic size={34} strokeWidth={1.8} aria-hidden className={state === "muted" ? "text-ink-muted" : "text-white"} />
        )}
      </span>
    </button>
  );
}
