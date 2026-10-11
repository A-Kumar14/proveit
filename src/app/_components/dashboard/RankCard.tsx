import Link from "next/link";
import type { CourseRank, Rewards } from "@proveit/server/store";
import { cn } from "@proveit/lib/cn";
import { TierBadge, tierColor } from "./TierBadge";
import { TierCelebration } from "./TierCelebration";
import { RankExpander } from "./RankExpander";
import { Widget } from "./Widget";

/** Rank: prestige for proven understanding. Nothing is bought or unlocked, it only shows how far you've come. */
export function RankCard({ r, courses, previewable, userId = "local" }: { r: Rewards; courses: CourseRank[]; previewable: boolean; userId?: string }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div id="rank" className="scroll-mt-4">
      <Widget title="Overall rank" action={{ label: "All courses", href: "/courses" }}
        aside={<TierCelebration key={userId} userId={userId} tierIndex={r.tierIndex} tierId={r.tier.id} tierName={r.tier.name} points={r.points} previewable={previewable} />}>
        <RankExpander
          collapsed={<RankTrack r={r} />}
          expanded={(
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <TierBadge id={r.tier.id} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3"><span className="text-[1.375rem] font-semibold leading-tight">{r.tier.name}</span><span className="text-sm tabular-nums text-ink-muted">{fmt(r.points)} points</span></div>
              <div className="mt-2 flex items-center gap-3">
                <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.pct} aria-label={r.next ? `Progress to ${r.next.name}` : "Top tier reached"} className="h-2 flex-1 rounded-full bg-surface-active">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: `linear-gradient(90deg, ${tierColor(r.tier.id).from}, ${tierColor(r.tier.id).to})` }} />
                </div>
                <span className="w-44 text-right text-xs text-ink-muted">{r.next ? `${fmt(r.toNext)} to ${r.next.name}` : "Top tier reached"}</span>
              </div>
            </div>
          </div>

          <ol className="m-0 grid list-none grid-cols-7 gap-2 p-0" aria-label="Tiers">
            {r.ladder.map((t) => (
              <li key={t.id} aria-current={t.current ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
                <TierBadge id={t.id} size={t.current ? 38 : 30} filled={t.reached} className={cn(t.current && "outline outline-2 outline-offset-2")} style={t.current ? { outlineColor: tierColor(t.id).to } : undefined} />
                <span className={cn("text-[0.6875rem]", t.current ? "font-semibold" : t.reached ? "text-ink-3" : "text-ink-faint")} data-tier-text style={t.current ? { color: tierColor(t.id).text } : undefined}>{t.name}</span>
                <span className="text-[0.625rem] tabular-nums text-ink-faint">{fmt(t.min)}</span>
              </li>
            ))}
          </ol>

          <section aria-label="Rank by course" className="flex flex-col gap-1.5">
            <h3 className="m-0 text-[0.6875rem] font-medium tracking-[0.06em] text-ink-faint uppercase">By course</h3>
            <p className="m-0 text-xs text-ink-muted">Your overall rank adds up everything across every course. Each course also has its own rank, with a ladder scaled to that course so completing its assessment allocations can reach the top.</p>
            <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-1 p-0 sm:grid-cols-2">
              {courses.map((c) => (
                <li key={c.courseId} className="flex items-center gap-2 border-t border-line py-1.5 text-xs">
                  <TierBadge id={c.tier.id} size={20} />
                  <Link href={`/course/${c.courseId}`} className="min-w-0 flex-1 truncate text-ink no-underline hover:underline">{c.name}</Link>
                  <span className="font-semibold">{c.tier.name}</span>
                  <span className="w-16 text-right tabular-nums text-ink-muted">{fmt(c.points)}</span>
                </li>
              ))}
            </ul>
          </section>

          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-ink-muted [&::-webkit-details-marker]:hidden">How points work</summary>
            <table className="mt-2 w-full border-collapse text-xs">
              <caption className="sr-only">Points by source</caption>
              <tbody>
                {r.breakdown.map((b) => (
                  <tr key={b.label} className="border-t border-line first:border-t-0">
                    <th scope="row" className="py-1.5 text-left font-normal text-ink-muted">{b.label}</th>
                    <td className="py-1.5 text-right tabular-nums text-ink-faint">{b.each ? `${b.count} × ${b.each}` : `${b.count} awards`}</td>
                    <td className="w-20 py-1.5 text-right font-semibold tabular-nums">{fmt(b.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 mt-2 max-w-xl text-[0.6875rem] leading-normal text-ink-faint">
              Earn points at 90% assessment mastery; 70% proficiency is a milestone with no points. Topic importance sets each allocation: a standard topic offers about 150 quiz points and 350 explanation points before weighting. Four distinct mastered quiz questions can accumulate across assessments to cover the full quiz allocation; repeating the same question never pays twice. Standard 20-topic courses offer up to 12,000 points, including a 2,000-point bonus after all allocations and delayed reviews are complete; smaller courses scale down. Transfer and review establish durable mastery. <Link href="/courses" className="text-ink-muted">Manage courses</Link>
            </p>
          </details>
        </div>
          )}
        />
      </Widget>
    </div>
  );
}


/**
 * The short form: one bar with a checkpoint for each tier. Tiers sit at even steps, not to scale,
 * because Legend is 500 times Silver and a true scale would bunch the first five into a corner.
 */
function RankTrack({ r }: { r: Rewards }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const steps = r.ladder.length - 1;
  const fill = Math.min(100, ((r.tierIndex + (r.next ? r.pct / 100 : 0)) / steps) * 100);
  const c = tierColor(r.tier.id);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-sm font-semibold" data-tier-text style={{ color: c.text }}>{r.tier.name}</span>
        <span className="text-sm tabular-nums text-ink-muted">{fmt(r.points)} points</span>
        <span className="ml-auto text-xs text-ink-muted">{r.next ? `${fmt(r.toNext)} to ${r.next.name}` : "Top tier reached"}</span>
      </div>
      <div className="relative px-4 pb-7 pt-3">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.pct} aria-label={r.next ? `Progress to ${r.next.name}` : "Top tier reached"} className="h-2 rounded-full bg-surface-active">
          <div className="h-full rounded-full" style={{ width: `${fill}%`, background: `linear-gradient(90deg, ${tierColor(r.ladder[0]!.id).from}, ${c.to})` }} />
        </div>
        <ol className="absolute inset-x-4 top-0 m-0 list-none p-0" aria-label="Tiers">
          {r.ladder.map((t, i) => (
            <li key={t.id} aria-current={t.current ? "step" : undefined} className="absolute flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ left: `${(i / steps) * 100}%` }}>
              <TierBadge id={t.id} size={t.current ? 24 : 20} filled={t.reached} className={cn(t.current && "outline outline-2 outline-offset-2")} style={t.current ? { outlineColor: tierColor(t.id).to } : undefined} />
              <span className={cn("whitespace-nowrap text-[0.625rem]", t.current ? "font-semibold" : t.reached ? "text-ink-3" : "text-ink-faint")} data-tier-text style={t.current ? { color: tierColor(t.id).text } : undefined}>{t.name}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
