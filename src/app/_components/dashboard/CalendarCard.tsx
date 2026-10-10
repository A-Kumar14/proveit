import Link from "next/link";
import type { Schedule } from "@proveit/server/schedule";
import { ago, addDaysTo, clock, dayHeading, dayKey } from "@proveit/lib/dates";
import { cn } from "@proveit/lib/cn";
import { CalendarControls } from "../calendar/CalendarControls";
import { KIND } from "../calendar/kinds";
import { Widget } from "./Widget";

const DAYS = 7;
const MAX = 7;

/** The next few days at a glance, plus connect and refresh. Real events replace the sample once a feed is connected. */
export function CalendarCard({ schedule, now = new Date() }: { schedule: Schedule; now?: Date }) {
  const { calendar, events } = schedule;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = events.filter((e) => new Date(e.end) >= now && new Date(e.start) < addDaysTo(start, DAYS));
  const shown = upcoming.slice(0, MAX);
  const days = [...new Set(shown.map((e) => dayKey(new Date(e.start) < start ? start : new Date(e.start))))];
  const connected = calendar.mode === "ics";
  return (
    <Widget title="Calendar" action={{ label: "Open calendar", href: "/calendar" }} className="min-w-0">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs text-ink-muted">
          {connected ? `${calendar.provider} · synced ${calendar.syncedAt ? ago(calendar.syncedAt) : "just now"}` : "Sample calendar. Connect yours so reviews and study blocks fit around your real week."}
        </p>
        {days.length === 0 && <p className="m-0 text-[13px] text-ink-muted">Nothing on the calendar for the next {DAYS} days.</p>}
        {days.map((day) => (
          <section key={day} aria-label={dayHeading(new Date(`${day}T00:00:00`), now)} className="flex flex-col gap-1">
            <h3 className="m-0 text-[11px] font-medium tracking-[0.06em] text-ink-faint uppercase">{dayHeading(new Date(`${day}T00:00:00`), now)}</h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {shown.filter((e) => dayKey(new Date(e.start) < start ? start : new Date(e.start)) === day).map((e) => (
                <li key={e.id} className={cn("flex items-center gap-2 rounded-sm border-l-[3px] px-2 py-1 text-xs", KIND[e.kind].chip)}>
                  <span className="w-[62px] shrink-0 tabular-nums text-ink-muted">{e.allDay ? "All day" : clock(e.start)}</span>
                  {e.href ? <Link href={e.href} className="min-w-0 flex-1 truncate text-ink no-underline hover:underline">{e.title}</Link> : <span className="min-w-0 flex-1 truncate">{e.title}</span>}
                  <span className="shrink-0 text-[10px] text-ink-faint">{KIND[e.kind].label}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {upcoming.length > MAX && <Link href="/calendar" className="text-xs text-ink-muted no-underline hover:text-ink">+{upcoming.length - MAX} more</Link>}
        <CalendarControls connected={connected} connectHref="/?connect=1" />
      </div>
    </Widget>
  );
}
