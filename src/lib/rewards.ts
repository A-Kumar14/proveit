/** Points are earned once for assessment mastery, plus a completed-course bonus. */
export const POINTS = { quiz: 150, explanation: 350, course: 2000 } as const;
export const PROFICIENCY = 70;
export const ASSESSMENT_MASTERY = 90;
export const QUIZ_COVERAGE_QUESTIONS = 4;
export const assessmentLevel = (pct: number): "Assessment mastered" | "Proficient" | "Developing" => pct >= ASSESSMENT_MASTERY ? "Assessment mastered" : pct >= PROFICIENCY ? "Proficient" : "Developing";
/** Twenty distinct topics make a standard course; smaller maps have a proportional budget. */
export const courseScale = (concepts: number) => Math.min(1, Math.max(1, concepts) / 20);
export const courseBudget = (concepts: number) => ({ quiz: Math.round(3000 * courseScale(concepts)), explanation: Math.round(7000 * courseScale(concepts)), bonus: Math.round(POINTS.course * courseScale(concepts)) });

/** Largest-remainder allocation preserves the exact budget with deterministic integer points. */
export function allocateBudget(budget: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const safe = weights.map(w => Number.isFinite(w) ? Math.max(1, Math.min(3, w)) : 2);
  const total = safe.reduce((a, b) => a + b, 0);
  const exact = safe.map(w => budget * w / total);
  const out = exact.map(Math.floor);
  const order = exact.map((v, i) => ({ i, rest: v - out[i]! })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  const remaining = budget - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) out[order[i]!.i]!++;
  return out;
}

export type Tier = { id: string; name: string; min: number };

/** The overall ladder. Each tier is a long climb: a standard fully mastered course is worth at most 12,000 points. */
export const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze", min: 0 },
  { id: "silver", name: "Silver", min: 1000 },
  { id: "gold", name: "Gold", min: 5000 },
  { id: "platinum", name: "Platinum", min: 10000 },
  { id: "diamond", name: "Diamond", min: 50000 },
  { id: "master", name: "Master", min: 100000 },
  { id: "legend", name: "Legend", min: 500000 },
];

/** Share of a course's reachable points each tier asks for. Legend is the whole course mastered. */
const COURSE_SHARE = [0, 0.1, 0.25, 0.45, 0.7, 0.9, 1];

/** Most a course can give by mastering every concept and finishing it. */
export const courseMaxPoints = (concepts: number) => Object.values(courseBudget(concepts)).reduce((a, b) => a + b, 0);

/** The same seven tiers, scaled to one course so a topic can be mastered in weeks, not years. */
export function courseTiers(concepts: number): Tier[] {
  const max = courseMaxPoints(concepts);
  return TIERS.map((t, i) => ({ ...t, min: Math.round((max * COURSE_SHARE[i]!) / 5) * 5 }));
}

export type Standing = {
  points: number;
  tierIndex: number;
  tier: Tier;
  next: Tier | null;
  toNext: number;
  /** 0 to 100, progress through the current tier. */
  pct: number;
};

export function standing(points: number, tiers: Tier[] = TIERS): Standing {
  const p = Math.max(0, Math.floor(points));
  let tierIndex = 0;
  tiers.forEach((t, i) => { if (p >= t.min) tierIndex = i; });
  const tier = tiers[tierIndex]!;
  const next = tiers[tierIndex + 1] ?? null;
  return { points: p, tierIndex, tier, next, toNext: next ? next.min - p : 0, pct: next ? Math.round(((p - tier.min) / (next.min - tier.min)) * 100) : 100 };
}

