"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../Button";
import { TierBadge, tierColor } from "./TierBadge";
import { useConfetti } from "./useConfetti";

const KEY = "proveit.tier.celebrated";

/**
 * Plays a short celebration when your tier is higher than the last one you saw, then remembers it.
 * The first visit only records the tier. Rank never goes down, so this only ever fires upward.
 * In demo mode a button replays it so the animation can be reviewed without earning a tier.
 */
export function TierCelebration({ tierIndex, tierId, tierName, points, previewable, userId = "local" }: { tierIndex: number; tierId: string; tierName: string; points: number; previewable: boolean; userId?: string }) {
  const storageKey = userId === "local" ? KEY : `${KEY}:${JSON.stringify(userId)}`;
  const confetti = useConfetti();
  const [open, setOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const celebrate = useCallback(() => {
    setOpen(true);
    const mid = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 40 };
    [0, 220, 460].forEach((ms) => timers.current.push(setTimeout(() => confetti(mid), ms)));
    timers.current.push(setTimeout(() => setOpen(false), 6000));
  }, [confetti]);

  useEffect(() => {
    let play: ReturnType<typeof setTimeout> | undefined;
    try {
      const seen = localStorage.getItem(storageKey);
      if (seen !== null && tierIndex > Number(seen)) play = setTimeout(celebrate, 0);
      if (seen === null || tierIndex > Number(seen)) localStorage.setItem(storageKey, String(tierIndex));
    } catch { /* storage unavailable: no celebration */ }
    return () => clearTimeout(play);
  }, [tierIndex, celebrate, storageKey]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <>
      {previewable && <Button size="sm" variant="secondary" onClick={celebrate}><Sparkles size={13} aria-hidden />Preview tier-up</Button>}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25" onClick={() => setOpen(false)}>
          <div role="status" className="relative flex w-[320px] flex-col items-center gap-3 rounded-lg border border-line bg-surface px-8 py-8 text-center shadow-[0_12px_32px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <span aria-hidden className="tier-ring absolute inset-0 rounded-full border-2" style={{ borderColor: tierColor(tierId).to }} />
              <TierBadge id={tierId} size={84} className="tier-pop" />
            </div>
            <div className="eyebrow">New rank</div>
            <div className="text-2xl font-semibold tracking-tight">You reached {tierName}</div>
            <div className="text-[0.8125rem] text-ink-muted">{points.toLocaleString("en-US")} points of proven understanding.</div>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Keep going</Button>
          </div>
        </div>
      )}
    </>
  );
}
