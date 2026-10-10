import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectCalendar, getCalendarState } from "./calendar";
import { assess, getCourse, getRewards, getTodos, listCourses } from "./store";

const RIGHT = "The 95% describes the method. Over many repeated samples, about 95% of the intervals built this way contain the true mean.";

beforeEach(() => {
  vi.stubEnv("PROVEIT_DATA", "");
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  disconnectCalendar();
});
afterEach(() => { vi.unstubAllEnvs(); (globalThis as { __proveit?: unknown }).__proveit = undefined; });

describe("real mode (no PROVEIT_DATA=demo)", () => {
  it("starts with one course, nothing started, no rank and no sample calendar", () => {
    const course = getCourse("intro-stats");
    expect(course.concepts.every((c) => c.state === "not_started" && c.dims.every((d) => d.tone === "none"))).toBe(true);
    expect(listCourses().map((c) => c.id)).toEqual(["intro-stats"]);
    expect(getRewards().points).toBe(0);
    expect(getTodos().flatMap((g) => g.done)).toEqual([]);
    expect(getCalendarState().events).toEqual([]);
  });

  it("moves a concept only because of an answer", async () => {
    await assess({ courseId: "intro-stats", conceptId: "cii", answer: RIGHT });
    const states = Object.fromEntries(getCourse("intro-stats").concepts.map((c) => [c.id, c.state]));
    expect(states.cii).toBe("developing");
    expect(Object.entries(states).filter(([id]) => id !== "cii").every(([, s]) => s === "not_started")).toBe(true);
  });
});
