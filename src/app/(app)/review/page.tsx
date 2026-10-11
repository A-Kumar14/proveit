import { withUserPage } from "@proveit/server/userBoundary";
import Link from "next/link";
import { AppShell } from "@proveit/app/_components/shell/AppShell";
import { EmptyState } from "@proveit/app/_components/shell/EmptyState";
import { buttonStyles } from "@proveit/app/_components/Button";
import { KIND } from "@proveit/app/_components/calendar/kinds";
import { clock, dayHeading, dayKey, addDaysTo } from "@proveit/lib/dates";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import { getReviewQueue, getSchedule } from "@proveit/server/schedule";

export const dynamic = "force-dynamic";

const DAYS = 7;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

function ReviewPage() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = getReviewQueue(now);
  const { calendar, events } = getSchedule();
  const upcoming = events.filter((e) => new Date(e.end) >= now && new Date(e.start) < addDaysTo(start, DAYS));
  const later = events.filter((e) => e.kind === "quiz" && new Date(e.start) >= addDaysTo(start, DAYS) && new Date(e.start) < addDaysTo(start, 21));
  const days = [...new Set(upcoming.map((e) => dayKey(new Date(e.start) < start ? start : new Date(e.start))))];
  const connected = calendar.mode === "ics";
  return (
    <AppShell active="review" crumbs={[{ label: "Review queue" }]}>
      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-8 overflow-y-auto px-7 py-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Review queue" className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="eyebrow">{connected ? calendar.provider : "No calendar connected"}</div>
            <h1 className="m-0 mt-1 text-[1.375rem] font-semibold">Review queue</h1>
            <p className="m-0 mt-2 max-w-xl text-[0.8125rem] text-ink-muted">
              Ordered by the next quiz or class on your calendar, then by what still needs work. Suggested times are free gaps. They are not added to the calendar.{" "}
              <Link href="/calendar" className="text-ink">Open the calendar</Link>
            </p>
          </div>
          {rows.length === 0 && (
            <EmptyState title="Nothing to queue" body="Once a course has a quiz or class coming up, the concepts that still need work show up here in that order." action={{ label: "Open the calendar", href: "/calendar" }} />
          )}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((row, i) => (
              <li key={row.id} className={cn("grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md border px-4 py-3", i === 0 ? "border-ink bg-surface" : "border-line")}>
                <span className="mt-0.5 text-sm font-semibold tabular-nums text-ink-faint" aria-hidden>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold">{row.name}</span>
                    {i === 0 && <span className="rounded-full bg-ink px-1.5 py-px text-[0.625rem] font-semibold text-white">Next</span>}
                    {row.state && <span className={cn("rounded-full px-1.5 py-px text-[0.625rem] font-semibold", LOOK[row.state].pill)}>{LOOK[row.state].label}</span>}
                    {row.pressure === "review" && <span className="rounded-full bg-developing-bg px-1.5 py-px text-[0.625rem] font-semibold text-developing-text">Review</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">{row.courseName}</div>
                  <div className="mt-1 text-xs text-ink-3">{row.because}</div>
                  {row.slot && <div className="mt-0.5 text-[0.6875rem] text-ink-muted">Suggested <time dateTime={row.slot.start} suppressHydrationWarning>{when(row.slot.start)}</time></div>}
                </div>
                {row.href ? <Link href={row.href} className={buttonStyles({ size: "sm" })}>{row.pressure === "review" ? "Review now" : "Start"}</Link> : <span className="pt-1 text-[0.6875rem] text-ink-faint">Not authored yet</span>}
              </li>
            ))}
          </ol>
        </section>

        <aside aria-label="Coming up" className="flex w-[300px] shrink-0 flex-col gap-3 self-start rounded-md border border-line p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold">Coming up</h2>
            <Link href="/calendar" className="text-xs text-ink-muted no-underline hover:text-ink">Calendar</Link>
          </div>
          <p className="m-0 text-xs text-ink-muted">{connected ? `Synced from ${calendar.provider}.` : "Connect a calendar to schedule around your real week."}</p>
          {days.length === 0 && <p className="m-0 text-[0.8125rem] text-ink-muted">Nothing on the calendar for the next {DAYS} days.</p>}
          {days.map((day) => (
            <section key={day} aria-label={dayHeading(new Date(`${day}T00:00:00`), now)} className="flex flex-col gap-1">
              <h3 className="m-0 text-[0.6875rem] font-medium text-ink-faint">{dayHeading(new Date(`${day}T00:00:00`), now)}</h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {upcoming.filter((e) => dayKey(new Date(e.start) < start ? start : new Date(e.start)) === day).map((e) => (
                  <li key={e.id} className={cn("flex items-center gap-2 rounded-sm border-l-[3px] px-2 py-1 text-xs", KIND[e.kind].chip)}>
                    <span className="w-[62px] shrink-0 tabular-nums text-ink-muted">{e.allDay ? "All day" : clock(e.start)}</span>
                    {e.href ? <Link href={e.href} className="min-w-0 flex-1 truncate text-ink no-underline hover:underline">{e.title}</Link> : <span className="min-w-0 flex-1 truncate">{e.title}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {later.length > 0 && (
            <section aria-label="Later" className="flex flex-col gap-1">
              <h3 className="m-0 text-[0.6875rem] font-medium text-ink-faint">Quizzes after this week</h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {later.map((e) => (
                  <li key={e.id} className={cn("rounded-sm border-l-[3px] px-2 py-1 text-xs", KIND[e.kind].chip)}>
                    <div className="text-ink-muted">{new Date(e.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                    {e.href ? <Link href={e.href} className="text-ink no-underline hover:underline">{e.title}</Link> : <span>{e.title}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

export default withUserPage(ReviewPage);

export const metadata = { title: "Review" };
