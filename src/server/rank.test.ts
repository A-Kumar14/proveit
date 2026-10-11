import { beforeEach, describe, expect, it } from "vitest";
import { getCourseRanks, getRewards, setTaskDone } from "./store";

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("assessment-ledger rank scope", () => {
  it("uses only quiz, explanation and course-bonus awards", () => {
    const course = getRewards("intro-stats");
    expect(course.breakdown.map((b) => b.label)).toEqual([
      "Quiz assessment mastery",
      "Explanation assessment mastery",
      "Course mastery bonuses",
    ]);
    const overall = getRewards();
    expect(overall.breakdown.map((b) => b.label)).toEqual([
      "Quiz assessment mastery",
      "Explanation assessment mastery",
      "Course mastery bonuses",
    ]);
  });

  it("gives every course its own scaled standing without granting points from seeded mastery state", () => {
    const ranks = getCourseRanks();
    expect(ranks.map((r) => r.courseId)).toContain("intro-stats");
    expect(ranks.every((r) => r.tier.id && r.points === 0)).toBe(true);
  });

  it("hand ticks earn nothing", () => {
    const before = getRewards("intro-stats").points;
    setTaskDone("cii", true);
    expect(getRewards("intro-stats").points).toBe(before);
  });

  it("rejects an unknown course", () => {
    expect(() => getRewards("nope")).toThrow();
  });
});
