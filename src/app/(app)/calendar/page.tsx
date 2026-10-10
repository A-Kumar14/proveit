import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { ConnectCalendarModal } from "@proveit/app/_components/calendar/ConnectCalendarModal";
import { CalendarControls } from "@proveit/app/_components/calendar/CalendarControls";
import { KIND } from "@proveit/app/_components/calendar/kinds";
import { MonthGrid } from "@proveit/app/_components/calendar/MonthGrid";
import { buttonStyles } from "@proveit/app/_components/Button";
import { ago, clock, dayHeading, dayKey, isDayKey, isMonthKey, monthKey, parseDay } from "@proveit/lib/dates";
import { cn } from "@proveit/lib/cn";
import { getScheduledTodos, getSchedule } from "@proveit/server/schedule";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { m, d, connect } = await searchParams;
  const now = new Date();
  const today = dayKey(now);
  const selected = isDayKey(d) ? d : isMonthKey(m) ? `${m}-01` : today;
  const month = isMonthKey(m) ? m : monthKey(parseDay(selected));
  const first = new Date(`${month}-01T00:00:00`);
  const prev = monthKey(new Date(first.getFullYear(), first.getMonth() - 1, 1));
  const next = monthKey(new Date(first.getFullYear(), first.getMonth() + 1, 1));
  const { calendar, events } = getSchedule();
  const connected = calendar.mode === "ics";

  const dayEvents = events.filter((e) => dayKey(new Date(e.start)) === selected);
  const study = getScheduledTodos(now).flatMap((g) => g.open).filter((t) => t.slot && dayKey(new Date(t.slot.start)) === selected);

  return (
    <AppShell active="calendar" crumbs={[{ label: "Calendar" }]} right={<CalendarControls compact connected={connected} connectHref={`/calendar?m=${month}&d=${selected}&connect=1`} />}>
      <div className="flex min-h-0 flex-1 gap-6 overflow-y-auto px-7 py-6">
        <section aria-label="Month" className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">{connected ? `${calendar.provider} · synced ${calendar.syncedAt ? ago(calendar.syncedAt) : "just now"}` : events.some((e) => e.id.startsWith("sample-")) ? "Sample calendar" : "No calendar connected"}</div>
              <h1 className="m-0 mt-1 text-[22px] font-semibold">{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href={`/calendar?m=${prev}`} aria-label="Previous month" className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "size-8 p-0")}><ChevronLeft size={16} aria-hidden /></Link>
              <Link href={`/calendar?m=${monthKey(now)}&d=${today}`} className={buttonStyles({ variant: "secondary", size: "sm" })}>Today</Link>
              <Link href={`/calendar?m=${next}`} aria-label="Next month" className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "size-8 p-0")}><ChevronRight size={16} aria-hidden /></Link>
            </div>
          </div>
          <MonthGrid month={month} selected={selected} today={today} events={events} />
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[11px] text-ink-muted" aria-label="Legend">
            {(Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => <li key={k} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", KIND[k].dot)} aria-hidden />{KIND[k].label}</li>)}
          </ul>
        </section>

        <aside aria-label="Selected day" className="flex w-[280px] shrink-0 flex-col gap-3 rounded-md border border-line p-4 self-start">
          <h2 className="m-0 text-sm font-semibold">{dayHeading(parseDay(selected), now)}</h2>
          {dayEvents.length === 0 && study.length === 0 && <p className="m-0 text-[13px] text-ink-muted">Nothing scheduled. A free day.</p>}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {dayEvents.map((e) => (
              <li key={e.id} className={cn("rounded-sm border-l-[3px] px-2.5 py-1.5", KIND[e.kind].chip)}>
                <div className="text-[13px] font-medium">{e.href ? <Link href={e.href} className="text-ink no-underline hover:underline">{e.title}</Link> : e.title}</div>
                <div className="text-[11px] text-ink-muted">{e.allDay ? "All day" : `${clock(e.start)} to ${clock(e.end)}`} · {KIND[e.kind].label}</div>
              </li>
            ))}
            {study.map((t) => (
              <li key={t.id} className={cn("rounded-sm border border-l-[3px] px-2.5 py-1.5", KIND.study.chip)}>
                <div className="text-[13px] font-medium">{t.href ? <Link href={t.href} className="text-ink no-underline hover:underline">{t.title}</Link> : t.title}</div>
                <div className="text-[11px] text-ink-muted">{clock(t.slot!.start)} to {clock(t.slot!.end)} · {KIND.study.label}</div>
              </li>
            ))}
          </ul>
          {study.length > 0 && <p className="m-0 text-[11px] text-ink-faint">Suggested blocks use free gaps in your calendar. They aren&apos;t added to it.</p>}
        </aside>
      </div>
      {connect && <ConnectCalendarModal closeHref={`/calendar?m=${month}&d=${selected}`} />}
    </AppShell>
  );
}
