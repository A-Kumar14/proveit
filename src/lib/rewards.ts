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

/** Each step asks for 500 more points than the last: 1,000, 1,500, 2,000, 2,500, 3,000, 3,500. */
export const TIERS: Tier[] = [
  { id: "bronze", name: "Bronze", min: 0 },
  { id: "silver", name: "Silver", min: 1000 },
  { id: "gold", name: "Gold", min: 2500 },
  { id: "platinum", name: "Platinum", min: 4500 },
  { id: "diamond", name: "Diamond", min: 7000 },
  { id: "master", name: "Master", min: 10000 },
  { id: "legend", name: "Legend", min: 13500 },
];

export type Standing = {
  points: number;
  tierIndex: number;
  tier: Tier;
  next: Tier | null;
  toNext: number;
  /** 0 to 100, progress through the current tier. */
  pct: number;
};

export function standing(points: number): Standing {
  const p = Math.max(0, Math.floor(points));
  let tierIndex = 0;
  TIERS.forEach((t, i) => { if (p >= t.min) tierIndex = i; });
  const tier = TIERS[tierIndex]!;
  const next = TIERS[tierIndex + 1] ?? null;
  return { points: p, tierIndex, tier, next, toNext: next ? next.min - p : 0, pct: next ? Math.round(((p - tier.min) / (next.min - tier.min)) * 100) : 100 };
}
