import { describe, expect, it } from "vitest";
import { courseBudget } from "@proveit/lib/rewards";
import { awardAssessment, awardCourseBonus, makeCourseRewards } from "./rewardLedger";

describe("weighted assessment rewards", () => {
  it("uses the requested 3k/7k/2k standard-course budget and scales smaller maps", () => {
    expect(courseBudget(20)).toEqual({ quiz: 3000, explanation: 7000, bonus: 2000 });
    expect(courseBudget(10)).toEqual({ quiz: 1500, explanation: 3500, bonus: 1000 });
  });

  it("allocates more points to more important topics while preserving the exact budget", () => {
    const plan = makeCourseRewards([
      { name: "supporting", importance: 1 },
      { name: "important", importance: 2 },
      { name: "core", importance: 3 },
    ]);
    const topics = Object.values(plan.topics);
    expect(topics.reduce((n, t) => n + t.quiz, 0)).toBe(courseBudget(3).quiz);
    expect(topics.reduce((n, t) => n + t.explanation, 0)).toBe(courseBudget(3).explanation);
    expect(plan.topics.core!.quiz).toBeGreaterThan(plan.topics.important!.quiz);
    expect(plan.topics.important!.quiz).toBeGreaterThan(plan.topics.supporting!.quiz);
    expect(plan.topics.core!.explanation).toBeGreaterThan(plan.topics.important!.explanation);
  });

  it("treats 70 percent as proficiency with no points and 90 percent as assessment mastery", () => {
    const plan = makeCourseRewards([{ name: "Topic", importance: 2 }]);
    expect(awardAssessment(plan, "Topic", "explanation", 70, 1, "a1")).toMatchObject({ level: "Proficient", pointsGained: 0 });
    expect(awardAssessment(plan, "Topic", "explanation", 89.9, 1, "a2").pointsGained).toBe(0);
    expect(awardAssessment(plan, "Topic", "explanation", 90, 1, "a3")).toMatchObject({ level: "Assessment mastered", pointsGained: plan.topics.topic!.explanation });
    expect(awardAssessment(plan, "Topic", "explanation", 100, 1, "a4").pointsGained).toBe(0);
  });

  it("accumulates four distinct mastered quiz questions across quizzes and never pays a repeat twice", () => {
    const plan = makeCourseRewards([{ name: "Topic", importance: 2 }]);
    const allocation = plan.topics.topic!.quiz;
    const first = awardAssessment(plan, "Topic", "quiz", 90, ["Question A"], "q1").pointsGained;
    const repeat = awardAssessment(plan, "Topic", "quiz", 100, ["Question A"], "q2").pointsGained;
    const second = awardAssessment(plan, "Topic", "quiz", 95, ["Question B"], "q3").pointsGained;
    const rest = awardAssessment(plan, "Topic", "quiz", 100, ["Question C", "Question D", "Question E"], "q4").pointsGained;
    expect(first).toBe(Math.floor(allocation / 4));
    expect(repeat).toBe(0);
    expect(second).toBe(Math.floor(allocation * 2 / 4) - Math.floor(allocation / 4));
    expect(first + second + rest).toBe(allocation);
    expect(plan.topics.topic!.quizCoverage).toBe(4);
    expect(plan.topics.topic!.quizEvidence).toHaveLength(4);
  });

  it("does not count quiz coverage from a merely proficient assessment", () => {
    const plan = makeCourseRewards([{ name: "Topic" }]);
    expect(awardAssessment(plan, "Topic", "quiz", 70, ["Question A"], "q1").pointsGained).toBe(0);
    expect(plan.topics.topic!.quizCoverage).toBe(0);
    expect(plan.topics.topic!.quizEvidence).toEqual([]);
  });

  it("awards the course bonus once only after both allocations and durable mastery are complete", () => {
    const plan = makeCourseRewards([{ name: "Topic" }]);
    expect(awardCourseBonus(plan, true, "r0")).toBe(0);
    awardAssessment(plan, "Topic", "quiz", 100, ["A", "B", "C", "D"], "q1");
    awardAssessment(plan, "Topic", "explanation", 100, 1, "a1");
    expect(awardCourseBonus(plan, false, "r1")).toBe(0);
    expect(awardCourseBonus(plan, true, "r2")).toBe(plan.bonus);
    expect(awardCourseBonus(plan, true, "r3")).toBe(0);
  });
});
