// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseRank, Rewards } from "@proveit/server/store";
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
  it("keeps tier memories separate when accounts share a browser", async () => {
    localStorage.setItem(KEY, "6");
    const { unmount } = render(<TierCelebration userId="A" tierIndex={2} tierId="gold" tierName="Gold" points={2500} previewable={false} />);
    await settle();
    expect(localStorage.getItem(`${KEY}:"A"`)).toBe("2");
    unmount();
    render(<TierCelebration userId="B" tierIndex={0} tierId="bronze" tierName="Bronze" points={0} previewable={false} />);
    await settle();
    expect(localStorage.getItem(`${KEY}:"B"`)).toBe("0");
    expect(localStorage.getItem(`${KEY}:"A"`)).toBe("2");
    expect(localStorage.getItem(KEY)).toBe("6");
    expect(screen.queryByRole("status")).toBeNull();
  });

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
    await waitFor(() => expect(fire).toHaveBeenCalled());
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

const rank = (courseId: string, name: string, points: number, tierIndex: number): CourseRank => {
  const s = standing(points);
  return { courseId, name, ...s, tierIndex };
};
const COURSES = [rank("intro-stats", "Intro Statistics", 2600, 2), rank("pf", "Personal Finance", 0, 0)];

describe("RankCard", () => {
  it("shows the tier, points, distance to the next tier and the whole ladder", () => {
    render(<RankCard r={rewards(6000)} courses={COURSES} previewable={false} />);
    expect(screen.getByText("Platinum", { selector: "span.text-\\[1\\.375rem\\]" })).toBeTruthy();
    expect(screen.getByText("1,000 to Diamond")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress to Diamond" }).getAttribute("aria-valuenow")).toBe("60");
    const steps = within(screen.getByRole("list", { name: "Tiers" })).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(steps.filter((s) => s.getAttribute("aria-current") === "step")).toHaveLength(1);
  });

  it("labels the rank as overall and lists each course's own rank", () => {
    render(<RankCard r={rewards(6000)} courses={COURSES} previewable={false} />);
    expect(screen.getByRole("region", { name: "Overall rank" })).toBeTruthy();
    const list = within(screen.getByRole("region", { name: "Rank by course" }));
    expect(list.getByText("Intro Statistics").closest("li")!.textContent).toContain("Gold");
    expect(list.getByText("Intro Statistics").closest("li")!.textContent).toContain("2,600");
    expect(list.getByText("Personal Finance").closest("li")!.textContent).toContain("Bronze");
  });

  it("says when the top tier is reached", () => {
    render(<RankCard r={rewards(20000)} courses={COURSES} previewable={false} />);
    expect(screen.getByText("Top tier reached")).toBeTruthy();
  });
});
