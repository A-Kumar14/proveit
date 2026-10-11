"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@proveit/lib/cn";

const KEY = "proveit.rank.expanded";
const listeners = new Set<() => void>();
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Shows the short rank track, or the full card. The choice is remembered in this browser. Starts collapsed. */
export function RankExpander({ collapsed, expanded }: { collapsed: React.ReactNode; expanded: React.ReactNode }) {
  const open = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, open ? "0" : "1"); } catch { /* not remembered */ }
    listeners.forEach((l) => l());
  }, [open]);
  return (
    <>
      <div id="rank-details">{open ? expanded : collapsed}</div>
      <div className="-mb-2 -mt-1 flex justify-center">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="rank-details" aria-label={open ? "Show less rank detail" : "Show full rank details"}
          className="flex h-6 w-11 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink">
          <ChevronDown size={16} strokeWidth={2} aria-hidden className={cn("transition-transform duration-200", open && "rotate-180")} />
        </button>
      </div>
    </>
  );
}
