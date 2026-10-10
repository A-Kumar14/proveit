// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReviewResultView } from "@proveit/server/store";
import { ReviewResultCard } from "./ReviewResultCard";

afterEach(cleanup);

const base: ReviewResultView = {
  courseId: "intro-stats", courseName: "Intro Statistics", conceptName: "CI interpretation",
  previous: "provisional", next: "mastered", nextReview: "Oct 17", pointsEarned: 100, coursePct: 50, provenLabel: "6 mastered",
};

describe("ReviewResultCard", () => {
  it("explains that delayed retrieval promoted provisional mastery", () => {
    render(<ReviewResultCard r={base} />);
    expect(screen.getByText("Mastered. You still had it.")).toBeTruthy();
    expect(screen.getByText("Promoted to Mastered")).toBeTruthy();
    expect(screen.getByText("+100")).toBeTruthy();
    expect(screen.getByText("Oct 17")).toBeTruthy();
  });

  it("does not award another mastery bonus for a periodic review", () => {
    render(<ReviewResultCard r={{ ...base, previous: "mastered", pointsEarned: 0, nextReview: "Oct 31" }} />);
    expect(screen.getByText("Still retained.")).toBeTruthy();
    expect(screen.getByText("Mastered retained")).toBeTruthy();
    expect(screen.getByText("+0")).toBeTruthy();
  });
});
