import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...a: unknown[]) => lookup(...a) }));

import { assertSafeUrl, CalendarError, connectCalendar, disconnectCalendar, getCalendarState, isPrivateAddress, parseIcs, refreshCalendar, suggestSlots, type CalEvent } from "./calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:lec
DTSTART:20261012T100000Z
DTEND:20261012T105000Z
SUMMARY:Stats lecture
RRULE:FREQ=WEEKLY;COUNT=3
EXDATE:20261019T100000Z
END:VEVENT
BEGIN:VEVENT
UID:quiz
DTSTART;VALUE=DATE:20261015
SUMMARY:Quiz day
END:VEVENT
END:VCALENDAR`;
const FROM = new Date("2026-10-01T00:00:00Z");
const TO = new Date("2026-12-01T00:00:00Z");

beforeEach(() => { lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]); disconnectCalendar(); });
afterEach(() => vi.unstubAllGlobals());

describe("parseIcs", () => {
  it("expands recurring events and drops deleted occurrences", () => {
    const lectures = parseIcs(ICS, FROM, TO).filter((e) => e.title === "Stats lecture");
    expect(lectures.map((e) => e.start.slice(0, 10))).toEqual(["2026-10-12", "2026-10-26"]);
    expect(lectures[0]).toMatchObject({ allDay: false, end: "2026-10-12T10:50:00.000Z" });
  });

  it("flags all-day events and sorts by start", () => {
    const events = parseIcs(ICS, FROM, TO);
    expect(events.find((e) => e.title === "Quiz day")?.allDay).toBe(true);
    expect(events.map((e) => e.start)).toEqual([...events.map((e) => e.start)].sort());
  });

  it("keeps only events inside the window", () => {
    expect(parseIcs(ICS, new Date("2026-10-14T00:00:00Z"), new Date("2026-10-16T00:00:00Z")).map((e) => e.title)).toEqual(["Quiz day"]);
  });

  it("returns nothing for an empty calendar", () => {
    expect(parseIcs("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR", FROM, TO)).toEqual([]);
  });
});

describe("assertSafeUrl", () => {
  it("turns webcal into https", async () => {
    expect((await assertSafeUrl("webcal://cal.example.com/me.ics")).protocol).toBe("https:");
  });

  it("refuses plain http, junk, localhost and private addresses", async () => {
    for (const bad of ["http://cal.example.com/a.ics", "not a url", "https://localhost/a.ics", "https://127.0.0.1/a.ics", "https://10.0.0.5/a.ics", "https://[::1]/a.ics", "https://printer.local/a.ics"]) {
      await expect(assertSafeUrl(bad), bad).rejects.toThrow(CalendarError);
    }
  });

  it("refuses a hostname that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "192.168.1.20", family: 4 }]);
    await expect(assertSafeUrl("https://sneaky.example.com/a.ics")).rejects.toThrow("public calendar");
  });

  it("classifies private ranges", () => {
    expect(["10.1.1.1", "172.16.0.1", "172.31.255.1", "192.168.0.1", "169.254.1.1", "127.0.0.1", "::1", "fd00::1"].every(isPrivateAddress)).toBe(true);
    expect(["8.8.8.8", "172.32.0.1", "93.184.216.34"].some(isPrivateAddress)).toBe(false);
  });
});

describe("connect, refresh, disconnect", () => {
  const feed = (body = ICS, status = 200) => vi.fn().mockResolvedValue(new Response(body, { status }));

  it("starts disconnected with no fabricated events and refuses to refresh", async () => {
    expect(getCalendarState()).toMatchObject({ mode: "none", provider: null, syncedAt: null, events: [] });
    await expect(refreshCalendar()).rejects.toThrow("No calendar is connected");
  });

  it("connects a feed, names the provider and never exposes the secret link", async () => {
    vi.stubGlobal("fetch", feed());
    const s = await connectCalendar("webcal://calendar.google.com/calendar/ical/secret-token/basic.ics");
    expect(s).toMatchObject({ mode: "ics", provider: "Google Calendar" });
    expect(s.syncedAt).toBeGreaterThan(0);
    expect(JSON.stringify(s)).not.toContain("secret-token");
  });

  it("picks up changes on refresh", async () => {
    vi.stubGlobal("fetch", feed());
    await connectCalendar("https://calendar.google.com/calendar/ical/x/basic.ics");
    vi.stubGlobal("fetch", feed(ICS.replace("Quiz day", "Quiz moved")));
    await refreshCalendar();
    expect(getCalendarState().events.some((e) => e.title === "Quiz moved")).toBe(true);
  });

  it("rejects a link that is not a calendar and stays disconnected", async () => {
    vi.stubGlobal("fetch", feed("<html>sign in</html>"));
    await expect(connectCalendar("https://example.com/page")).rejects.toThrow("iCal");
    expect(getCalendarState().mode).toBe("none");
  });

  it("reports an HTTP error and a failed connection", async () => {
    vi.stubGlobal("fetch", feed("", 404));
    await expect(connectCalendar("https://example.com/a.ics")).rejects.toThrow("404");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(connectCalendar("https://example.com/a.ics")).rejects.toThrow("Couldn't reach");
  });

  it("re-checks every redirect hop", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1/internal" } })));
    await expect(connectCalendar("https://example.com/a.ics")).rejects.toThrow("public calendar");
  });

  it("disconnects back to an empty calendar", async () => {
    vi.stubGlobal("fetch", feed());
    await connectCalendar("https://example.com/a.ics");
    expect(disconnectCalendar()).toMatchObject({ mode: "none", provider: null, events: [] });
  });
});

describe("suggestSlots", () => {
  const ev = (start: string, end: string, allDay = false): CalEvent => ({ id: start, title: "x", start: new Date(start).toISOString(), end: new Date(end).toISOString(), allDay, kind: "other" });
  const NOW = new Date(2026, 9, 12, 8, 0); // Mon Oct 12, 8:00 local

  it("takes the first free half hour, one per day", () => {
    const slots = suggestSlots([], 3, NOW);
    expect(slots.map((s) => new Date(s.start).getDate())).toEqual([12, 13, 14]);
    expect(new Date(slots[0]!.start).getHours()).toBe(9);
    expect(new Date(slots[0]!.end).getTime() - new Date(slots[0]!.start).getTime()).toBe(30 * 60_000);
  });

  it("slides past busy blocks and starts on a quarter hour", () => {
    const busy = [ev("2026-10-12T09:00:00", "2026-10-12T10:50:00")];
    const s = suggestSlots(busy.map((b) => ({ ...b, start: new Date(2026, 9, 12, 9).toISOString(), end: new Date(2026, 9, 12, 10, 50).toISOString() })), 1, NOW)[0]!;
    expect([new Date(s.start).getHours(), new Date(s.start).getMinutes()]).toEqual([11, 0]);
  });

  it("uses a small gap between events when it is long enough", () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m).toISOString();
    const busy: CalEvent[] = [{ ...ev("2026-10-12T00:00:00", "2026-10-12T00:00:00"), start: at(9), end: at(10) }, { ...ev("2026-10-12T00:00:00", "2026-10-12T00:00:00"), start: at(10, 30), end: at(12) }];
    expect(new Date(suggestSlots(busy, 1, NOW)[0]!.start).getHours()).toBe(10);
  });

  it("does not let all-day events block time", () => {
    const allDay = ev("2026-10-12T00:00:00", "2026-10-13T00:00:00", true);
    expect(new Date(suggestSlots([allDay], 1, NOW)[0]!.start).getHours()).toBe(9);
  });

  it("never suggests a time in the past or after closing", () => {
    const late = new Date(2026, 9, 12, 20, 50);
    const slots = suggestSlots([], 2, late);
    expect(slots.every((s) => new Date(s.start) >= late)).toBe(true);
    expect(new Date(slots[0]!.start).getDate()).toBe(13);
  });

  it("returns fewer slots when the days are full", () => {
    const full: CalEvent[] = Array.from({ length: 7 }, (_, i) => ({ ...ev("2026-10-12T00:00:00", "2026-10-12T00:00:00"), start: new Date(2026, 9, 12 + i, 8).toISOString(), end: new Date(2026, 9, 12 + i, 21).toISOString() }));
    expect(suggestSlots(full, 3, NOW)).toEqual([]);
  });
});
