import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import type { CourseRank, CourseRow } from "@proveit/server/store";
import { TierBadge } from "./TierBadge";
import { MasteryBar } from "../mastery/MasteryBar";

/** One course in the ticker: name, progress, and a four-line table of what's done and what isn't. */
export function TickerCard({ c, rank }: { c: CourseRow; rank?: CourseRank }) {
  const rows: [string, number, string][] = [
    ["Completed", c.proven, "text-mastered-text"],
    ["In progress", c.inProgress, "text-developing-text"],
    ["Needs work", c.needsWork, "text-needswork-text"],
    ["Not started", c.notStarted, "text-ink-3"],
  ];
  return (
    <li className="relative mr-3 flex w-[264px] shrink-0 flex-col gap-3 rounded-md border border-line bg-surface p-4 hover:bg-surface-subtle">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/course/${c.id}`} className="text-[15px] font-semibold text-ink no-underline after:absolute after:inset-0 after:content-['']">{c.name}</Link>
        {c.completed
          ? <span className="flex shrink-0 items-center gap-1 rounded-full bg-mastered-bg px-2 py-0.5 text-[11px] font-semibold text-mastered-text"><CircleCheck size={11} strokeWidth={2.2} aria-hidden />Done</span>
          : <span className="shrink-0 rounded-full bg-developing-bg px-2 py-0.5 text-[11px] font-semibold text-developing-text">Active</span>}
      </div>
      <div className="flex items-center gap-2">
        <MasteryBar pct={c.pct} barClass={c.pct >= 40 ? "bg-mastered" : "bg-developing"} label={`${c.name} mastery ${c.pct}%`} />
        <span className="w-8 text-right text-xs">{c.pct}%</span>
      </div>
      {rank && (
        <div className="flex items-center gap-2 text-xs" aria-label={`Course rank ${rank.tier.name}, ${rank.points.toLocaleString("en-US")} points`}>
          <TierBadge id={rank.tier.id} size={20} />
          <span className="font-semibold">{rank.tier.name}</span>
          <span className="text-ink-muted">course rank</span>
          <span className="ml-auto tabular-nums text-ink-muted">{rank.points.toLocaleString("en-US")}</span>
        </div>
      )}
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{c.name} concepts by status</caption>
        <tbody>
          {rows.map(([label, n, color]) => (
            <tr key={label} className="border-t border-line first:border-t-0">
              <th scope="row" className="py-1 text-left font-normal text-ink-muted">{label}</th>
              <td className={cn("py-1 text-right font-semibold tabular-nums", n === 0 ? "text-ink-faint" : color)}>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="truncate text-[11px] text-ink-faint">{c.completed ? (c.manual ? "Marked completed by you" : "Every concept mastered") : c.next ? `Next: ${c.next}` : "Nothing left to start"}</div>
    </li>
  );
}
