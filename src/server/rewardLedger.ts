import "server-only";
import { createHash } from "node:crypto";
import { allocateBudget, assessmentLevel, ASSESSMENT_MASTERY, courseBudget, QUIZ_COVERAGE_QUESTIONS } from "@proveit/lib/rewards";

export const rewardName = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
export const rewardFingerprint = (source: string) => createHash("sha256").update(rewardName(source)).digest("hex");
export type RewardTopic = { name: string; weight: number; quiz: number; explanation: number; quizCoverage: number; quizEvidence: string[]; explanationEarned: boolean; quizBest: number | null; explanationBest: number | null };
export type RewardAward = { category: "quiz" | "explanation" | "bonus"; evidenceId: string; points: number; at: number };
export type CourseRewards = { topics: Record<string, RewardTopic>; bonus: number; bonusEarned: boolean; awards: RewardAward[] };
export type RewardLedger = { version: 2; courses: Record<string, CourseRewards> };
export const emptyRewardLedger = (): RewardLedger => ({ version: 2, courses: {} });

/** Frozen at first enrollment/access. Duplicate topic names cannot inflate the budget. */
export function makeCourseRewards(topics: { name: string; importance?: number }[]): CourseRewards {
  const distinct = [...new Map(topics.map(t => [rewardName(t.name), t])).entries()].sort(([a], [b]) => a.localeCompare(b));
  const budget = courseBudget(distinct.length);
  const quiz = allocateBudget(budget.quiz, distinct.map(([, t]) => t.importance ?? 2));
  const explanation = allocateBudget(budget.explanation, distinct.map(([, t]) => t.importance ?? 2));
  return {
    topics: Object.fromEntries(distinct.map(([key, t], i) => [key, { name: t.name, weight: t.importance ?? 2, quiz: quiz[i]!, explanation: explanation[i]!, quizCoverage: 0, quizEvidence: [], explanationEarned: false, quizBest: null, explanationBest: null }])),
    bonus: budget.bonus, bonusEarned: false, awards: [],
  };
}

/** Caller supplies server-graded marks and server-held coverage, never client scores. */
export function awardAssessment(plan: CourseRewards, name: string, category: "quiz" | "explanation", score: number | null, coverage: number | string[], evidenceId: string, at = Date.now()) {
  const empty = { score, level: score === null ? null : assessmentLevel(score), pointsGained: 0 };
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return { ...empty, score: null, level: null };
  const topic = Object.hasOwn(plan.topics, rewardName(name)) ? plan.topics[rewardName(name)] : undefined;
  if (!topic) return empty;
  const best = category === "quiz" ? "quizBest" : "explanationBest";
  topic[best] = Math.max(topic[best] ?? 0, score);
  if (score < ASSESSMENT_MASTERY) return empty;
  let points = 0;
  if (category === "quiz") {
    const previous = topic.quizCoverage;
    let next = previous;
    if (Array.isArray(coverage)) {
      const seen = new Set(topic.quizEvidence ?? []);
      for (const question of coverage) {
        if (seen.size >= QUIZ_COVERAGE_QUESTIONS) break;
        seen.add(rewardFingerprint(question));
      }
      topic.quizEvidence = [...seen];
      next = Math.max(previous, Math.min(QUIZ_COVERAGE_QUESTIONS, seen.size));
    } else {
      // Numeric coverage remains accepted for compatibility with callers that already hold a trusted aggregate.
      next = Math.max(previous, Math.min(QUIZ_COVERAGE_QUESTIONS, Math.max(0, Math.floor(coverage))));
    }
    points = Math.floor(topic.quiz * next / QUIZ_COVERAGE_QUESTIONS) - Math.floor(topic.quiz * previous / QUIZ_COVERAGE_QUESTIONS);
    topic.quizCoverage = next;
  } else if (!topic.explanationEarned) {
    points = topic.explanation;
    topic.explanationEarned = true;
  }
  if (points > 0) plan.awards.push({ category, evidenceId, points, at });
  return { ...empty, pointsGained: points };
}

export function awardCourseBonus(plan: CourseRewards, allDurablyMastered: boolean, evidenceId: string, at = Date.now()): number {
  if (!allDurablyMastered || plan.bonusEarned || !Object.keys(plan.topics).length) return 0;
  // Completing both assessment allocations plus durable mastery makes the course's top tier reachable exactly once.
  if (!Object.values(plan.topics).every(t => t.quizCoverage === QUIZ_COVERAGE_QUESTIONS && t.explanationEarned)) return 0;
  plan.bonusEarned = true;
  plan.awards.push({ category: "bonus", evidenceId, points: plan.bonus, at });
  return plan.bonus;
}
