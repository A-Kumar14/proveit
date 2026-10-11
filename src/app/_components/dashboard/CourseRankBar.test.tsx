// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { courseTiers, standing } from "@proveit/lib/rewards";
import type { CourseRank } from "@proveit/server/store";
import { CourseRankBar } from "./CourseRankBar";

afterEach(cleanup);
const rank = (points: number): CourseRank => ({ courseId: "c", name: "C", ...standing(points, courseTiers(10)) });

describe("CourseRankBar", () => {
  it("shows the tier, and how far to the next one on this course's own ladder", () => {
    render(<CourseRankBar rank={rank(700)} />);
    expect(screen.getByText("Silver")).toBeTruthy();
    expect(screen.getByText("365 to Gold")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progress to Gold" }).getAttribute("aria-valuenow")).toBe("43");
  });
  it("says so at the top tier", () => {
    render(<CourseRankBar rank={rank(4250)} />);
    expect(screen.getByText("Top tier reached", { selector: "span" })).toBeTruthy();
  });
});
