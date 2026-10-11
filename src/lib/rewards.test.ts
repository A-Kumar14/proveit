import { describe, expect, it } from "vitest";
import { courseMaxPoints, courseTiers, standing, TIERS } from "./rewards";

describe("tiers", () => {
  it("asks for 0, 1k, 5k, 10k, 50k, 100k and 500k points", () => {
    expect(TIERS.map((t) => t.min)).toEqual([0, 1000, 5000, 10000, 50000, 100000, 500000]);
  });

  it("puts a total in the right tier on the boundaries", () => {
    expect(standing(0).tier.name).toBe("Bronze");
    expect(standing(999).tier.name).toBe("Bronze");
    expect(standing(1000).tier.name).toBe("Silver");
    expect(standing(4999).tier.name).toBe("Silver");
    expect(standing(5000).tier.name).toBe("Gold");
    expect(standing(10000).tier.name).toBe("Platinum");
    expect(standing(50000).tier.name).toBe("Diamond");
    expect(standing(100000).tier.name).toBe("Master");
    expect(standing(500000).tier.name).toBe("Legend");
  });

  it("reports distance to the next tier and progress through the current one", () => {
    expect(standing(3000)).toMatchObject({ tierIndex: 1, toNext: 2000, pct: 50, next: { name: "Gold" } });
  });

  it("tops out at the last tier", () => {
    expect(standing(999999)).toMatchObject({ tier: { name: "Legend" }, next: null, toNext: 0, pct: 100 });
  });

  it("ignores negative and fractional totals", () => {
    expect(standing(-50).points).toBe(0);
    expect(standing(1999.9).points).toBe(1999);
  });
});

describe("course tiers", () => {
  it("scale to the course, and Legend is everything mastered", () => {
    const t = courseTiers(10);
    expect(courseMaxPoints(10)).toBe(6000);
    expect(t.map((x) => x.min)).toEqual([0, 600, 1500, 2700, 4200, 5400, 6000]);
    expect(standing(6000, t).tier.name).toBe("Legend");
    expect(standing(5999, t).tier.name).toBe("Master");
  });
  it("keeps every tier above the last, even for a tiny course", () => {
    const mins = courseTiers(1).map((x) => x.min);
    expect(mins.every((m, i) => i === 0 || m > mins[i - 1]!)).toBe(true);
  });
});

