"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Scrolls its children left to right like a ticker. Three copies keep the loop seamless, the extra two
 * are hidden from assistive tech and keyboard focus. Moving content can be paused, and stops on hover or focus.
 * With reduced motion it becomes a plain horizontally scrolling row.
 */
export function CourseTicker({ children, count }: { children: React.ReactNode; count: number }) {
  const [paused, setPaused] = useState(false);
  // A few cards don't fill the row, so looping would show the same card twice. Lay them out still.
  if (count < 4) return <ul aria-label="Your courses" className="m-0 flex list-none p-0">{children}</ul>;
  return (
    <div className="flex flex-col gap-2">
      <div className="ticker overflow-hidden" data-paused={paused} role="region" aria-label="Your courses">
        <div className="ticker-track flex w-max" style={{ ["--ticker-duration" as string]: `${Math.max(count, 3) * 15}s` }}>
          <ul data-copy="main" className="m-0 flex list-none p-0">{children}</ul>
          <ul data-copy="dup" aria-hidden inert className="m-0 flex list-none p-0">{children}</ul>
          <ul data-copy="dup" aria-hidden inert className="m-0 flex list-none p-0">{children}</ul>
        </div>
      </div>
      <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)} className="flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-ink-muted hover:text-ink motion-reduce:hidden">
        {paused ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}{paused ? "Resume scrolling" : "Pause scrolling"}
      </button>
    </div>
  );
}
