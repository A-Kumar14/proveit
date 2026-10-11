import type { CourseRank } from "@proveit/server/store";
import { cn } from "@proveit/lib/cn";
import { TierBadge, tierColor } from "./TierBadge";

/** One course's rank: tier, points, and a bar to the next tier. The ladder is scaled to the course, so a topic can reach the top. */
export function CourseRankBar({ rank, className }: { rank: CourseRank; className?: string }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div className={cn("flex items-center gap-2.5 text-xs", className)} aria-label={`Course rank ${rank.tier.name}, ${fmt(rank.points)} points`}>
      <TierBadge id={rank.tier.id} size={24} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2"><span className="font-semibold" style={{ color: tierColor(rank.tier.id).text }}>{rank.tier.name}</span><span className="tabular-nums text-ink-muted">{fmt(rank.points)} pts</span><span className="ml-auto text-ink-muted">{rank.next ? `${fmt(rank.toNext)} to ${rank.next.name}` : "Top tier reached"}</span></div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rank.pct} aria-label={rank.next ? `Progress to ${rank.next.name}` : "Top tier reached"} className="h-1.5 rounded-full bg-surface-active"><div className="h-full rounded-full" style={{ width: `${rank.pct}%`, background: `linear-gradient(90deg, ${tierColor(rank.tier.id).from}, ${tierColor(rank.tier.id).to})` }} /></div>
      </div>
    </div>
  );
}
