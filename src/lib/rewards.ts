/**
 * Rank rules. Points come only from evidence (concepts proved or mastered, misconceptions repaired,
 * courses finished on their own merit, a daily streak). Ticking a task or marking a course done earns nothing,
 * so rank can't be farmed by clicking.
 */
export const POINTS = {
  /** Passed a new-question test (Provisional). */ proved: 200,
  /** Mastered, which includes the proved points. */ mastered: 300,
  /** Fixed a caught misconception, once per concept. */ repaired: 100,
  /** Passed the new question on the first try, once per concept. */ firstTry: 50,
  /** Every concept in a course Mastered. Marking it done by hand earns nothing. */ course: 1000,
  /** A concept answered right in a quiz, once per concept. A quiz is practice, so this is small. */ quiz: 25,
  /** Per day of streak, up to STREAK_CAP days. */ streakDay: 25,
} as const;
export const STREAK_CAP = 7;

export type Tier = { id: string; name: string; min: number };

/** The overall ladder. Each tier is a long climb: a fully mastered course is worth about 9,000 points. */
export const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze", min: 0 },
  { id: "silver", name: "Silver", min: 1000 },
  { id: "gold", name: "Gold", min: 5000 },
  { id: "platinum", name: "Platinum", min: 10000 },
  { id: "diamond", name: "Diamond", min: 50000 },
  { id: "master", name: "Master", min: 100000 },
  { id: "legend", name: "Legend", min: 500000 },
];

/** Share of a course's reachable points each tier asks for. Legend is the whole course mastered and quizzed. */
const COURSE_SHARE = [0, 0.1, 0.25, 0.45, 0.7, 0.9, 1];

/** Most a course can give by mastering every concept, answering each right in a quiz, and finishing it. */
export const courseMaxPoints = (concepts: number) => concepts * (POINTS.mastered + POINTS.quiz) + POINTS.course;

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
