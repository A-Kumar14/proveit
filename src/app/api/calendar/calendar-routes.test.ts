import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) }));

import { disconnectCalendar, getCalendarState } from "@proveit/server/calendar";
import { POST as connect } from "./connect/route";
import { POST as disconnect } from "./disconnect/route";
import { POST as refresh } from "./refresh/route";
import { POST as todo } from "../todos/complete/route";

const post = (handler: (r: Request) => Promise<Response>, body: unknown) => handler(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
const ICS = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:a\nDTSTART:20261020T100000Z\nDTEND:20261020T110000Z\nSUMMARY:Midterm review\nEND:VEVENT\nEND:VCALENDAR";

beforeEach(() => { disconnectCalendar(); (globalThis as { __proveit?: unknown }).__proveit = undefined; });

describe("calendar routes", () => {
  it("connects, refreshes and disconnects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(ICS)));
    expect((await post(connect, { url: "https://calendar.google.com/calendar/ical/x/basic.ics" })).status).toBe(200);
    expect(getCalendarState().mode).toBe("ics");
    expect((await post(refresh, {})).status).toBe(200);
    expect((await post(disconnect, {})).status).toBe(200);
    expect(getCalendarState().mode).toBe("none");
    vi.unstubAllGlobals();
  });

  it("answers 400 with a readable message for a bad link or a refresh with nothing connected", async () => {
    const bad = await post(connect, { url: "http://insecure.example.com/a.ics" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("https");
    const none = await post(refresh, {});
    expect(none.status).toBe(400);
    expect((await none.json()).error).toContain("No calendar is connected");
    expect((await post(connect, {})).status).toBe(400);
  });
});

describe("POST /api/todos/complete", () => {
  it("ticks, answers 409 for progress-finished tasks and 404 for unknown ones", async () => {
    expect((await post(todo, { id: "pv", done: true })).status).toBe(200);
    expect((await post(todo, { id: "pop", done: false })).status).toBe(409);
    expect((await post(todo, { id: "nope", done: true })).status).toBe(404);
    expect((await post(todo, { id: "", done: true })).status).toBe(400);
  });
});
