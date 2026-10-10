import "server-only";
import { getCalendarState, suggestSlots, type CalEvent, type CalendarState, type Slot } from "./calendar";
import { getCourseEvents, getReviews, getTodos, listCourses, taskRank, type Task, type TodoGroup } from "./store";

/** Everything the calendar views and the to-do list need, with the student's calendar and the courses side by side. */

export type Schedule = { calendar: CalendarState; events: CalEvent[] };

export function getSchedule(): Schedule {
  const calendar = getCalendarState();
  const events = [...calendar.events, ...getCourseEvents()].sort((a, b) => a.start.localeCompare(b.start));
  return { calendar, events };
}

export type ScheduledTask = Task & { slot: Slot | null; next: boolean };
export type ScheduledGroup = Omit<TodoGroup, "open"> & { open: ScheduledTask[] };

/**
 * Attaches a free-time suggestion to the most urgent open tasks across all courses.
 * Slots come from gaps in the student's own timed events, one per day.
 */
export function getScheduledTodos(now = new Date(), suggestions = 3): ScheduledGroup[] {
  const groups = getTodos();
  const { calendar } = getSchedule();
  const ranked = groups.flatMap((g) => g.open).sort((a, b) => taskRank(a) - taskRank(b));
  const slots = suggestSlots(calendar.events, suggestions, now);
  const slotFor = new Map(ranked.slice(0, suggestions).map((t, i) => [t.id, slots[i] ?? null]));
  const firstId = ranked[0]?.id;
  return groups.map((g) => ({ ...g, open: g.open.map((t) => ({ ...t, slot: slotFor.get(t.id) ?? null, next: t.id === firstId })) }));
}

const HORIZON_DAYS = 21;
const SLOT_COUNT = 3;
const STATE_RANK: Record<Task["state"], number> = { needs_work: 0, developing: 1, provisional: 2, not_started: 3, mastered: 4 };

export type QueuePressure = "review" | "quiz" | "class";
export type QueueRow = {
  id: string; name: string; courseName: string; state: Task["state"] | null; href: string | null;
  pressure: QueuePressure; because: string; eventStart: string; slot: Slot | null;
};

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** A class event belongs to a course when its title names that course. Sample titles say "Personal Finance seminar", not the full course name. */
function classMatchesCourse(title: string, courseName: string) {
  const t = title.toLowerCase();
  const n = courseName.toLowerCase();
  if (t.includes(n)) return true;
  const head = n.split(/\s+/).slice(0, 2).join(" ");
  return head.length > 3 && t.includes(head);
}

/** The event that makes a course urgent: the soonest quiz in the window, otherwise the soonest class. */
function driverFor(courseId: string, courseName: string, events: CalEvent[], now: Date): CalEvent | null {
  const horizon = addDays(now, HORIZON_DAYS);
  const live = events.filter((e) => new Date(e.end) >= now && new Date(e.start) < horizon);
  const quizzes = live.filter((e) => e.kind === "quiz" && (e.id === `quiz:${courseId}` || e.href === `/course/${courseId}`));
  const classes = live.filter((e) => e.kind === "class" && classMatchesCourse(e.title, courseName));
  const picked = (quizzes.length ? quizzes : classes).sort((a, b) => a.start.localeCompare(b.start));
  return picked[0] ?? null;
}

const because = (pressure: QueuePressure, start: string, due: boolean) => {
  const when = new Date(start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (pressure === "review") return due ? "Due now" : `Comes back ${when}`;
  return pressure === "quiz" ? `Before the quiz, ${when}` : `Before class, ${when}`;
};

/**
 * One ordered list of what to study next. Due reviews come first. Everything else is ordered by the
 * soonest quiz or class on the calendar, then by how far the concept is from mastered.
 */
export function getReviewQueue(now = new Date()): QueueRow[] {
  const { events } = getSchedule();
  const { due, upcoming } = getReviews(now);
  const openCourses = new Set(listCourses().filter((c) => !c.completed).map((c) => c.name));
  const reviews: QueueRow[] = [...due, ...upcoming].filter((r) => openCourses.has(r.courseName)).map((r) => {
    const start = r.due ? dayStart(now).toISOString() : new Date(`${r.day}T00:00:00`).toISOString();
    return { id: `review:${r.id}`, name: r.name, courseName: r.courseName, state: null, href: r.due ? r.href : null, pressure: "review", because: because("review", start, r.due), eventStart: start, slot: null };
  });
  const practice: QueueRow[] = getTodos().flatMap((g) => {
    const event = driverFor(g.courseId, g.courseName, events, now);
    if (!event) return [];
    const pressure: QueuePressure = event.kind === "quiz" ? "quiz" : "class";
    return g.open.filter((t) => t.kind === "practice" && t.state !== "not_started").map((t) => ({
      id: t.id, name: t.title, courseName: t.courseName, state: t.state, href: t.href, pressure, because: because(pressure, event.start, false), eventStart: event.start, slot: null,
    }));
  });
  const rows = [...reviews, ...practice].sort((a, b) => a.eventStart.localeCompare(b.eventStart) || (a.state ? STATE_RANK[a.state] : -1) - (b.state ? STATE_RANK[b.state] : -1));
  const slots = suggestSlots(events, Math.min(SLOT_COUNT, rows.length), now);
  return rows.map((row, i) => ({ ...row, slot: slots[i] ?? null }));
}
