import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ical, { type VEvent } from "node-ical";

/**
 * Calendar engine. Pulls events from any iCal (.ics) feed, which covers Google ("secret address in iCal format"),
 * Apple (public calendar link) and Outlook, and finds free time between them.
 * Until a calendar is connected it serves clearly labelled sample events.
 */

export type CalKind = "class" | "quiz" | "review" | "other";
export type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; kind: CalKind; href?: string };
export type Slot = { start: string; end: string };

export type CalendarState = {
  mode: "sample" | "ics";
  /** Display name for the connected provider, never the secret URL itself. */
  provider: string | null;
  syncedAt: number | null;
  events: CalEvent[];
};

type Held = CalendarState & { url: string | null };
const g = globalThis as unknown as { __proveitCal?: Held };
const held = (): Held => (g.__proveitCal ??= { mode: "sample", provider: null, syncedAt: null, events: [], url: null });

export class CalendarError extends Error {}

// ---- parsing ----

const WINDOW_DAYS = 90;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Reads an iCal document into events inside [from, to). Recurring events are expanded, deleted occurrences dropped. */
export function parseIcs(text: string, from: Date, to: Date): CalEvent[] {
  let data: Awaited<ReturnType<typeof ical.async.parseICS>>;
  try {
    data = ical.sync.parseICS(text);
  } catch {
    throw new CalendarError("That doesn't look like a calendar feed.");
  }
  const out: CalEvent[] = [];
  for (const [uid, raw] of Object.entries(data)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const e = raw as VEvent;
    if (!(e.start instanceof Date)) continue;
    const allDay = e.datetype === "date";
    const length = e.end instanceof Date ? e.end.getTime() - e.start.getTime() : allDay ? 86_400_000 : 0;
    const skipped = new Set(Object.keys(e.exdate ?? {}).map((k) => k.slice(0, 10)));
    const starts = e.rrule ? e.rrule.between(from, to, true).filter((d) => !skipped.has(d.toISOString().slice(0, 10))) : [e.start];
    for (const s of starts) {
      const end = new Date(s.getTime() + length);
      if (end < from || s >= to) continue;
      const title = typeof e.summary === "string" ? e.summary : (e.summary as { val?: string } | undefined)?.val ?? "Busy";
      out.push({ id: `${uid}@${s.toISOString()}`, title, start: s.toISOString(), end: end.toISOString(), allDay, kind: "other" });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ---- fetching, with the checks a server-side fetch of a user-supplied URL needs ----

const MAX_BYTES = 2 * 1024 * 1024;
const privateV4 = (ip: string) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(ip);
const privateV6 = (ip: string) => /^(::1?$|f[cd]|fe[89ab]|::ffff:)/i.test(ip);
export const isPrivateAddress = (ip: string) => (isIP(ip) === 4 ? privateV4(ip) : privateV6(ip));

/** https only, and never a private address, so the feed URL can't be used to reach the server's own network. */
export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new CalendarError("Paste the full calendar link, starting with https:// or webcal://.");
  }
  if (url.protocol !== "https:") throw new CalendarError("Calendar links must use https.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new CalendarError("That address isn't a public calendar.");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => { throw new CalendarError("Couldn't find that calendar address."); })).map((a) => a.address);
  if (addrs.some(isPrivateAddress)) throw new CalendarError("That address isn't a public calendar.");
  return url;
}

async function fetchText(raw: string): Promise<string> {
  let url = await assertSafeUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { accept: "text/calendar, text/plain" } }).catch(() => {
      throw new CalendarError("Couldn't reach that calendar. Check the link and try again.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertSafeUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new CalendarError(`The calendar answered with an error (${res.status}). Check that the link is the secret iCal address.`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new CalendarError("That calendar is too large to import.");
    if (!text.includes("BEGIN:VCALENDAR")) throw new CalendarError("That link isn't an iCal feed. Use the secret address in iCal format.");
    return text;
  }
  throw new CalendarError("The calendar link redirected too many times.");
}

const providerName = (host: string) =>
  /google/.test(host) ? "Google Calendar" : /icloud|apple/.test(host) ? "Apple Calendar" : /outlook|office365|live\.com/.test(host) ? "Outlook" : host;

async function pull(url: string) {
  const now = new Date();
  const text = await fetchText(url);
  return parseIcs(text, dayStart(now), new Date(dayStart(now).getTime() + WINDOW_DAYS * 86_400_000));
}

export async function connectCalendar(raw: string): Promise<CalendarState> {
  const url = await assertSafeUrl(raw);
  const events = await pull(url.toString());
  Object.assign(held(), { mode: "ics", url: url.toString(), provider: providerName(url.hostname), syncedAt: Date.now(), events });
  return getCalendarState();
}

/** Re-reads the connected feed. With only the sample calendar there is nothing to sync, so it says so. */
export async function refreshCalendar(): Promise<CalendarState> {
  const h = held();
  if (h.mode !== "ics" || !h.url) throw new CalendarError("You're using the sample calendar. Connect yours to sync it.");
  h.events = await pull(h.url);
  h.syncedAt = Date.now();
  return getCalendarState();
}

export function disconnectCalendar(): CalendarState {
  Object.assign(held(), { mode: "sample", url: null, provider: null, syncedAt: null, events: [] });
  return getCalendarState();
}

// ---- reading ----

/** Sample week for the next four weeks: lectures, a seminar, office hours and a part-time shift. */
export function sampleEvents(now = new Date()): CalEvent[] {
  const out: CalEvent[] = [];
  const at = (d: Date, h: number, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  for (let i = 0; i < 28; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const add = (title: string, kind: CalKind, h1: number, m1: number, h2: number, m2: number) =>
      out.push({ id: `sample-${title}-${d.toISOString().slice(0, 10)}`, title, start: at(d, h1, m1).toISOString(), end: at(d, h2, m2).toISOString(), allDay: false, kind });
    const dow = d.getDay();
    if (dow === 2 || dow === 4) add("Intro Statistics lecture", "class", 10, 0, 10, 50);
    if (dow === 3) add("Personal Finance seminar", "class", 14, 0, 15, 15);
    if (dow === 5) add("Office hours", "other", 13, 0, 14, 0);
    if (dow === 1 || dow === 3) add("Shift at the campus cafe", "other", 17, 0, 21, 0);
  }
  return out.filter((e) => new Date(e.end) > now);
}

export function getCalendarState(): CalendarState {
  const h = held();
  return { mode: h.mode, provider: h.provider, syncedAt: h.syncedAt, events: h.mode === "ics" ? h.events : sampleEvents() };
}

// ---- free time ----

type Interval = { start: Date; end: Date };

/**
 * Proposes up to `count` study slots, at most one per day, in the first free gap of the day
 * between 9:00 and 21:00. All-day events don't block time. Slots start on a quarter hour.
 */
export function suggestSlots(events: CalEvent[], count: number, now = new Date(), opts: { minutes?: number; fromHour?: number; toHour?: number; days?: number } = {}): Slot[] {
  const { minutes = 30, fromHour = 9, toHour = 21, days = 7 } = opts;
  const busy: Interval[] = events.filter((e) => !e.allDay).map((e) => ({ start: new Date(e.start), end: new Date(e.end) })).sort((a, b) => a.start.getTime() - b.start.getTime());
  const slots: Slot[] = [];
  for (let i = 0; i < days && slots.length < count; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), fromHour);
    const close = new Date(day.getFullYear(), day.getMonth(), day.getDate(), toHour);
    if (cursor < now) cursor = new Date(Math.ceil(now.getTime() / 900_000) * 900_000);
    for (const b of busy) {
      if (b.end <= cursor || b.start >= close) continue;
      if (b.start.getTime() - cursor.getTime() >= minutes * 60_000) break;
      if (b.end > cursor) cursor = new Date(Math.ceil(b.end.getTime() / 900_000) * 900_000);
    }
    const end = new Date(cursor.getTime() + minutes * 60_000);
    if (end <= close) slots.push({ start: cursor.toISOString(), end: end.toISOString() });
  }
  return slots;
}
