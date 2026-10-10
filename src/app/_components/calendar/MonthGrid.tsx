import Link from "next/link";
import { cn } from "@proveit/lib/cn";
import { addDaysTo, dayKey, monthKey } from "@proveit/lib/dates";
import type { CalEvent } from "@proveit/server/calendar";
import { KIND } from "./kinds";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHOWN = 2;

/** Month view. Each day links to itself, so the selected day lives in the URL and works without scripts. */
export function MonthGrid({ month, selected, today, events }: { month: string; selected: string; today: string; events: CalEvent[] }) {
  const first = new Date(`${month}-01T00:00:00`);
  const gridStart = addDaysTo(first, -first.getDay());
  const byDay = new Map<string, CalEvent[]>();
  for (const e of events) {
    const k = dayKey(new Date(e.start));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysTo(gridStart, w * 7 + d)));
  return (
    <table className="w-full table-fixed border-collapse text-xs" aria-label={first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
      <thead>
        <tr>{WEEKDAYS.map((d) => <th key={d} scope="col" className="border-b border-line pb-2 text-left text-[11px] font-medium text-ink-faint">{d}</th>)}</tr>
      </thead>
      <tbody>
        {weeks.map((week, i) => (
          <tr key={i}>
            {week.map((day) => {
              const key = dayKey(day);
              const list = byDay.get(key) ?? [];
              const inMonth = monthKey(day) === month;
              return (
                <td key={key} className={cn("h-[88px] border-b border-r border-line p-0 align-top first:border-l", !inMonth && "bg-surface-subtle")}>
                  <Link href={`/calendar?m=${month}&d=${key}`} aria-current={key === selected ? "date" : undefined}
                    aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${list.length} ${list.length === 1 ? "event" : "events"}`}
                    className={cn("flex h-full flex-col gap-0.5 p-1.5 text-ink no-underline hover:bg-surface-hover", key === selected && "bg-surface-active")}>
                    <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px]", key === today ? "bg-ink font-semibold text-white" : inMonth ? "text-ink" : "text-ink-faint")}>{day.getDate()}</span>
                    {list.slice(0, SHOWN).map((e) => (
                      <span key={e.id} className={cn("truncate rounded-[3px] border-l-[3px] px-1 py-px text-[10px]", KIND[e.kind].chip)}>{e.title}</span>
                    ))}
                    {list.length > SHOWN && <span className="text-[10px] text-ink-faint">+{list.length - SHOWN} more</span>}
                  </Link>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
