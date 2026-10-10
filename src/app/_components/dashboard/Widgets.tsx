import Link from "next/link";
import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { DashboardWidgets } from "@proveit/server/store";
import { buttonStyles } from "../Button";
import { StatusPill } from "../mastery/StatusPill";
import { Empty, Widget } from "./Widget";

export function UpNext({ d }: { d: DashboardWidgets }) {
  const n = d.upNext;
  return (
    <Widget title="Up next" className="col-span-2">
      {n ? (
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="text-lg font-semibold">{n.concept}</span><StatusPill state={n.state} /></div>
            <div className="mt-0.5 text-xs text-ink-muted">{n.course}</div>
            <p className="m-0 mt-2 max-w-xl text-[13px] leading-normal text-ink-3">{n.why}</p>
          </div>
          <Link href={n.href} className={cn(buttonStyles(), "shrink-0")}>Start practice</Link>
        </div>
      ) : <Empty>You&apos;re caught up. Nothing is waiting to be tested.</Empty>}
    </Widget>
  );
}

export function NeedsAttention({ d }: { d: DashboardWidgets }) {
  return (
    <Widget title="Needs attention" action={{ label: "Misconception log", href: `/course/${d.activeCourseId}/misconceptions` }}>
      {d.attention.length === 0 ? <Empty>No open misconceptions.</Empty> : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {d.attention.map((m) => (
            <li key={m.key} className="flex items-center gap-2.5">
              <CircleAlert size={15} strokeWidth={1.8} className="shrink-0 text-needswork-text" aria-hidden />
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{m.name}</div><div className="truncate text-xs text-ink-muted">{m.concept}</div></div>
              <Link href={m.href} className={buttonStyles({ variant: "secondary", size: "sm" })}>Fix it</Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

export function DueForReview({ d }: { d: DashboardWidgets }) {
  const { due, upcoming, nextWhen } = d.reviews;
  return (
    <Widget title="Due for review" action={{ label: "Review queue", href: "/review" }}>
      {due + upcoming === 0 ? <Empty>Nothing scheduled. Pass a new question and the concept comes back for review.</Empty> : (
        <div className="flex items-end gap-6">
          <div><div className="text-[28px] font-semibold leading-none tabular-nums">{due}</div><div className="mt-1 text-xs text-ink-muted">due now</div></div>
          <div><div className="text-[28px] font-semibold leading-none tabular-nums text-ink-3">{upcoming}</div><div className="mt-1 text-xs text-ink-muted">coming up{nextWhen && due === 0 ? `, next ${nextWhen}` : ""}</div></div>
        </div>
      )}
    </Widget>
  );
}

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

export function UpcomingQuizzes({ d }: { d: DashboardWidgets }) {
  return (
    <Widget title="Upcoming quizzes">
      {d.quizzes.length === 0 ? <Empty>No quizzes on the calendar.</Empty> : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {d.quizzes.map((q) => (
            <li key={q.course} className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-center"><div className="text-xl font-semibold leading-none tabular-nums">{q.daysLeft}</div><div className="text-[10px] text-ink-faint">{q.daysLeft === 1 ? "day" : "days"}</div></div>
              <Link href={q.href} className="min-w-0 flex-1 text-ink no-underline hover:underline"><div className="truncate text-[13px] font-semibold">{q.course}</div><div className="truncate text-xs text-ink-muted">{q.label}</div></Link>
            </li>
          ))}
        </ul>
      )}
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
