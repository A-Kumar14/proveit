import { beforeEach, describe, expect, it } from "vitest";
import { exportLearning, getAccountStats, getCourse, getHistory, NotFoundError, resetCourseProgress } from "./store";
import { assess } from "./store";

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("account stats", () => {
  it("counts concepts by state and reports streaks", () => {
    const s = getAccountStats();
    expect(Object.values(s.byState).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
    expect(s.bestStreak).toBeGreaterThanOrEqual(s.streak);
  });
});

describe("export", () => {
  it("has every course with its concepts and no secrets", () => {
    const e = exportLearning();
    expect(e.courses.map((c) => c.id)).toContain("intro-stats");
    expect(e.courses[0]!.concepts[0]).toHaveProperty("state");
    expect(JSON.stringify(e)).not.toMatch(/api[_-]?key|secret|token/i);
  });
});

describe("start a course over", () => {
  it("puts every concept back to Not started and drops the course's answers", async () => {
    await assess({ courseId: "intro-stats", conceptId: "cii", answer: "There is a 95% probability the true mean is in my interval." });
    expect(getHistory().length).toBeGreaterThan(0);
    resetCourseProgress("intro-stats");
    const course = getCourse("intro-stats");
    expect(course.concepts.every((c) => c.state === "not_started")).toBe(true);
    expect(exportLearning().attempts.filter((a) => a.courseId === "intro-stats")).toEqual([]);
  });

  it("refuses a course that doesn't exist", () => {
    expect(() => resetCourseProgress("nope")).toThrow(NotFoundError);
  });
});
