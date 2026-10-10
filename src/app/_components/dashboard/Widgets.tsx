import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { DashboardWidgets } from "@proveit/server/store";
import { Empty, Widget } from "./Widget";

const SEG: Record<string, string> = { mastered: "bg-mastered", provisional: "bg-mastered-bg outline outline-1 outline-dashed outline-mastered", developing: "bg-developing", needs_work: "bg-needswork", not_started: "bg-surface-active" };

export function MasteryOverview({ d }: { d: DashboardWidgets }) {
  const total = d.mastery.reduce((n, s) => n + s.count, 0);
  return (
    <Widget title="Mastery overview">
      <div className="flex flex-col gap-3">
        <div role="img" aria-label={d.mastery.map((s) => `${s.count} ${LOOK[s.state].label.toLowerCase()}`).join(", ")} className="flex h-2.5 gap-[3px]">
          {d.mastery.filter((s) => s.count > 0).map((s) => <div key={s.state} style={{ flex: s.count }} className={cn("rounded-[2px]", SEG[s.state])} />)}
        </div>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 text-xs">
          {d.mastery.map((s) => (
            <li key={s.state} className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-ink-muted"><span className={cn("size-2 rounded-full", LOOK[s.state].dot)} aria-hidden />{LOOK[s.state].label}</span><span className="font-semibold tabular-nums">{s.count}</span></li>
          ))}
        </ul>
        <div className="text-[11px] text-ink-faint">{total} concepts across all courses</div>
      </div>
    </Widget>
  );
}

export function StudyWeek({ d }: { d: DashboardWidgets }) {
  const { streak, days } = d.week;
  return (
    <Widget title="Study week">
      <div className="flex items-baseline gap-2"><span className="text-[28px] font-semibold leading-none tabular-nums">{streak}</span><span className="text-xs text-ink-muted">day streak</span></div>
      <ol className="m-0 flex list-none justify-between p-0" aria-label="Last 7 days">
        {days.map((day) => (
          <li key={day.iso} className="flex flex-col items-center gap-1.5">
            <span aria-label={`${day.iso}${day.today ? ", today" : ""}${day.active ? ", proved a concept" : ", no concept proved"}`} className={cn("flex size-7 items-center justify-center rounded-full border", day.active ? "border-mastered bg-mastered-line" : "border-line", day.today && "outline outline-2 outline-offset-2 outline-ink")}>
              {day.active && <CircleCheck size={14} strokeWidth={2.4} className="text-mastered" aria-hidden />}
            </span>
            <span className={cn("text-[11px]", day.today ? "font-semibold text-ink" : "text-ink-faint")} aria-hidden>{day.label}</span>
          </li>
        ))}
      </ol>
      <div className="text-[11px] text-ink-faint">A day counts when you pass a new question.</div>
    </Widget>
  );
}

const TONE = { good: [CircleCheck, "text-mastered-text"], warn: [CircleHelp, "text-developing-text"], bad: [CircleAlert, "text-needswork-text"] } as const;

export function RecentActivity({ d }: { d: DashboardWidgets }) {
  return (
    <Widget title="Recent activity" action={{ label: "History", href: "/history" }}>
      {d.recent.length === 0 ? <Empty>No attempts yet. Your answers show up here.</Empty> : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {d.recent.map((e) => {
            const [Icon, color] = TONE[e.tone];
            return (
              <li key={e.id} className="flex items-center gap-2.5">
                <Icon size={15} strokeWidth={1.8} className={cn("shrink-0", color)} aria-hidden />
                <Link href={e.href} className="min-w-0 flex-1 text-ink no-underline hover:underline"><div className="truncate text-[13px] font-semibold">{e.title}</div><div className="truncate text-xs text-ink-muted">{e.detail}</div></Link>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
