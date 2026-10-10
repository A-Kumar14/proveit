import Link from "next/link";
import type { Rewards } from "@proveit/server/store";
import { TierBadge } from "./TierBadge";

/** Small always-visible rank in the dashboard header. Links down to the full card. */
export function RankChip({ r }: { r: Rewards }) {
  return (
    <Link href="#rank" aria-label={`Overall rank ${r.tier.name}, ${r.points.toLocaleString("en-US")} points. Jump to rank details`} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs text-ink no-underline hover:bg-surface-hover">
      <TierBadge id={r.tier.id} size={22} />
      <span className="text-ink-faint">Overall</span>
      <span className="font-semibold">{r.tier.name}</span>
      <span className="tabular-nums text-ink-muted">{r.points.toLocaleString("en-US")}</span>
    </Link>
  );
}
