import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { disconnectCalendar, getCalendarState } from "./calendar";
import { assess, getCourse, getRewards, getTodos, listCourses } from "./store";
import { demoStateForTests } from "../test/demo-state";

const RIGHT = "The 95% describes the method. Over many repeated samples, about 95% of the intervals built this way contain the true mean.";
type TestGlobal = { __proveit?: unknown; __proveitTestSeedFactory?: () => unknown; __proveitCal?: unknown };

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const g = globalThis as unknown as TestGlobal;
  g.__proveitTestSeedFactory = undefined;
  g.__proveit = undefined;
  g.__proveitCal = undefined;
  disconnectCalendar();
});
afterEach(() => {
  const g = globalThis as unknown as TestGlobal;
  g.__proveit = undefined;
  g.__proveitCal = undefined;
  g.__proveitTestSeedFactory = demoStateForTests;
});

describe("real runtime state", () => {
  it("starts with one course, nothing started, no rank and no fabricated calendar", () => {
    const course = getCourse("intro-stats");
    expect(course.concepts.every((c) => c.state === "not_started" && c.dims.every((d) => d.tone === "none"))).toBe(true);
    expect(listCourses().map((c) => c.id)).toEqual(["intro-stats"]);
    expect(getRewards().points).toBe(0);
    expect(getTodos().flatMap((g) => g.done)).toEqual([]);
    expect(getCalendarState()).toMatchObject({ mode: "none", events: [] });
  });

  it("moves a concept only because of an answer", async () => {
    await assess({ courseId: "intro-stats", conceptId: "cii", answer: RIGHT });
    const states = Object.fromEntries(getCourse("intro-stats").concepts.map((c) => [c.id, c.state]));
    expect(states.cii).toBe("developing");
    expect(Object.entries(states).filter(([id]) => id !== "cii").every(([, state]) => state === "not_started")).toBe(true);
  });
});
