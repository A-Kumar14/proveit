import Link from "next/link";
import type { Rewards } from "@proveit/server/store";
import { POINTS } from "@proveit/lib/rewards";
import { cn } from "@proveit/lib/cn";
import { TierBadge } from "./TierBadge";
import { TierCelebration } from "./TierCelebration";
import { Widget } from "./Widget";

/** Rank: prestige for proven understanding. Nothing is bought or unlocked, it only shows how far you've come. */
export function RankCard({ r, previewable }: { r: Rewards; previewable: boolean }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div id="rank" className="scroll-mt-4">
      <Widget title="Rank" action={{ label: "All courses", href: "/courses" }}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <TierBadge id={r.tier.id} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3"><span className="text-[22px] font-semibold leading-tight">{r.tier.name}</span><span className="text-sm tabular-nums text-ink-muted">{fmt(r.points)} points</span></div>
              <div className="mt-2 flex items-center gap-3">
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.pct} aria-label={r.next ? `Progress to ${r.next.name}` : "Top tier reached"} className="h-2 flex-1 rounded-full bg-surface-active">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-44 text-right text-xs text-ink-muted">{r.next ? `${fmt(r.toNext)} to ${r.next.name}` : "Top tier reached"}</span>
              </div>
            </div>
            <TierCelebration tierIndex={r.tierIndex} tierId={r.tier.id} tierName={r.tier.name} points={r.points} previewable={previewable} />
          </div>

          <ol className="m-0 grid list-none grid-cols-7 gap-2 p-0" aria-label="Tiers">
            {r.ladder.map((t) => (
              <li key={t.id} aria-current={t.current ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
                <TierBadge id={t.id} size={t.current ? 38 : 30} filled={t.reached} className={cn(t.current && "outline outline-2 outline-offset-2 outline-ink")} />
                <span className={cn("text-[11px]", t.current ? "font-semibold text-ink" : t.reached ? "text-ink-3" : "text-ink-faint")}>{t.name}</span>
                <span className="text-[10px] tabular-nums text-ink-faint">{fmt(t.min)}</span>
              </li>
            ))}
          </ol>

          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-ink-muted [&::-webkit-details-marker]:hidden">How points work</summary>
            <table className="mt-2 w-full border-collapse text-xs">
              <caption className="sr-only">Points by source</caption>
              <tbody>
                {r.breakdown.map((b) => (
                  <tr key={b.label} className="border-t border-line first:border-t-0">
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-muted">{b.label}</th>
                    <td className="py-1.5 text-right tabular-nums text-ink-faint">{b.count} × {b.each}</td>
                    <td className="w-20 py-1.5 text-right font-semibold tabular-nums">{fmt(b.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 mt-2 max-w-xl text-[11px] leading-normal text-ink-faint">
              Points come from evidence: passing a new question ({POINTS.proved}), mastering a concept ({POINTS.mastered}), and the extras above. Ticking tasks or marking a course done earns nothing. Rank never drops, even if a concept slips. <Link href="/courses" className="text-ink-muted">Manage courses</Link>
            </p>
          </details>
        </div>
      </Widget>
    </div>
  );
}
