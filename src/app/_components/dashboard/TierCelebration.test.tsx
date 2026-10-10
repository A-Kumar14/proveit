// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Rewards } from "@proveit/server/store";
import { standing, TIERS } from "@proveit/lib/rewards";

const fire = vi.fn();
vi.mock("./useConfetti", () => ({ useConfetti: () => fire }));

import { RankCard } from "./RankCard";
import { TierCelebration } from "./TierCelebration";

const KEY = "proveit.tier.celebrated";
const rewards = (points: number): Rewards => {
  const s = standing(points);
  return { ...s, breakdown: [{ label: "Concepts mastered", count: 2, each: 300, points: 600 }], ladder: TIERS.map((t, i) => ({ ...t, reached: i <= s.tierIndex, current: i === s.tierIndex })) };
};
const mount = (tierIndex: number, previewable = false) => render(<TierCelebration tierIndex={tierIndex} tierId={TIERS[tierIndex]!.id} tierName={TIERS[tierIndex]!.name} points={tierIndex * 1000} previewable={previewable} />);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

beforeEach(() => { localStorage.clear(); fire.mockReset(); });
afterEach(cleanup);

describe("TierCelebration", () => {
  it("stays quiet on the first visit and only records the tier", async () => {
    mount(3);
    await settle();
    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem(KEY)).toBe("3");
  });

  it("celebrates when the tier is higher than the last one seen, then not again", async () => {
    localStorage.setItem(KEY, "2");
    const { unmount } = mount(3);
    await settle();
    expect(screen.getByRole("status").textContent).toContain("You reached Platinum");
    expect(fire).toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe("3");
    unmount();
    mount(3);
    await settle();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not celebrate for an equal or lower tier", async () => {
    localStorage.setItem(KEY, "4");
    mount(3);
    await settle();
    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem(KEY)).toBe("4");
  });

  it("can be dismissed", async () => {
    localStorage.setItem(KEY, "0");
    mount(1);
    await settle();
    await userEvent.click(screen.getByRole("button", { name: "Keep going" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers a preview button only when previewable, and it replays the animation", async () => {
    const { unmount } = mount(2);
    expect(screen.queryByRole("button", { name: /Preview tier-up/ })).toBeNull();
    unmount();
    mount(2, true);
    await userEvent.click(screen.getByRole("button", { name: /Preview tier-up/ }));
    expect(screen.getByRole("status").textContent).toContain("You reached Gold");
  });
});

describe("RankCard", () => {
  it("shows the tier, points, distance to the next tier and the whole ladder", () => {
    render(<RankCard r={rewards(6000)} previewable={false} />);
    expect(screen.getByText("Platinum", { selector: "span.text-\\[22px\\]" })).toBeTruthy();
    expect(screen.getByText("1,000 to Diamond")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress to Diamond" }).getAttribute("aria-valuenow")).toBe("60");
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps.filter((s) => s.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("says when the top tier is reached", () => {
    render(<RankCard r={rewards(20000)} previewable={false} />);
    expect(screen.getByText("Top tier reached")).toBeTruthy();
  });
});
