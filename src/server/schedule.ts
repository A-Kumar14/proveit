import "server-only";
import { getCalendarState, suggestSlots, type CalEvent, type CalendarState, type Slot } from "./calendar";
import { getCourseEvents, getTodos, taskRank, type Task, type TodoGroup } from "./store";

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

/** Slots for tasks and reviews due now, keyed by id, for the review queue. */
export function getReviewSlots(ids: string[], now = new Date()): Map<string, Slot> {
  const slots = suggestSlots(getSchedule().calendar.events, ids.length, now);
  return new Map(ids.flatMap((id, i) => (slots[i] ? [[id, slots[i]] as [string, Slot]] : [])));
}
