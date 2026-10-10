import { beforeEach, describe, expect, it } from "vitest";
import { getCourseRanks, getRewards, setTaskDone } from "./store";

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("rank scope", () => {
  it("scores a course on its own concepts only, with no streak", () => {
    const course = getRewards("intro-stats");
    expect(course.breakdown.map((b) => b.label)).not.toContain("Streak days, up to 7");
    const overall = getRewards();
    expect(overall.breakdown.map((b) => b.label)).toContain("Streak days, up to 7");
    // The overall rank also counts the other courses, so it is never lower than any one course.
    expect(overall.points).toBeGreaterThanOrEqual(course.points);
  });

  it("gives every course its own standing on the shared ladder", () => {
    const ranks = getCourseRanks();
    expect(ranks.map((r) => r.courseId)).toContain("intro-stats");
    expect(ranks.every((r) => r.tier.id && r.points >= 0)).toBe(true);
    expect(ranks.find((r) => r.courseId === "linear-algebra")!.points).toBeGreaterThan(ranks.find((r) => r.courseId === "intro-stats")!.points);
  });

  it("never lowers a course rank, and hand ticks earn nothing", () => {
    const before = getRewards("intro-stats").points;
    setTaskDone("cii", true);
    expect(getRewards("intro-stats").points).toBe(before);
  });

  it("rejects an unknown course", () => {
    expect(() => getRewards("nope")).toThrow();
  });
});
