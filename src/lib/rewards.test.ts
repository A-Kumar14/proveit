import { describe, expect, it } from "vitest";
import { standing, TIERS } from "./rewards";

describe("tiers", () => {
  it("each step asks for 500 more points than the last", () => {
    const gaps = TIERS.slice(1).map((t, i) => t.min - TIERS[i]!.min);
    expect(gaps).toEqual([1000, 1500, 2000, 2500, 3000, 3500]);
  });

  it("puts a total in the right tier on the boundaries", () => {
    expect(standing(0).tier.name).toBe("Bronze");
    expect(standing(999).tier.name).toBe("Bronze");
    expect(standing(1000).tier.name).toBe("Silver");
    expect(standing(4499).tier.name).toBe("Gold");
    expect(standing(4500).tier.name).toBe("Platinum");
    expect(standing(7000).tier.name).toBe("Diamond");
  });

  it("reports distance to the next tier and progress through the current one", () => {
    expect(standing(6000)).toMatchObject({ tierIndex: 3, toNext: 1000, pct: 60, next: { name: "Diamond" } });
    expect(standing(1000)).toMatchObject({ toNext: 1500, pct: 0 });
  });

  it("tops out at the last tier", () => {
    expect(standing(99999)).toMatchObject({ tier: { name: "Legend" }, next: null, toNext: 0, pct: 100 });
  });

  it("ignores negative and fractional totals", () => {
    expect(standing(-50).points).toBe(0);
    expect(standing(1999.9).points).toBe(1999);
  });
});
