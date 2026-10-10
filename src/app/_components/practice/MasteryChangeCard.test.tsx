// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ResultView } from "@proveit/server/store";
import { MasteryChangeCard } from "./MasteryChangeCard";

afterEach(cleanup);

const base: ResultView = {
  courseId: "intro-stats",
  courseName: "Intro Statistics",
  conceptName: "CI interpretation",
  previous: "developing",
  next: "provisional",
  diagnosisLabel: "Diagnosis",
  misconception: "None detected",
  intervention: "No remediation needed",
  transferText: "Correct on first try",
  nextReview: "Tomorrow, Oct 11",
  recommendation: "Keep going.",
  nextConcept: null,
  segments: ["mastered", "provisional", "developing"],
  coursePct: 50,
  provenLabel: "1 proven + 1 provisional",
};

describe("MasteryChangeCard diagnosis truthfulness", () => {
  it("does not claim a misconception or remediation when the first answer was sound", () => {
    render(<MasteryChangeCard r={base} />);
    expect(screen.getByText("Diagnosis")).toBeTruthy();
    expect(screen.getByText("None detected")).toBeTruthy();
    expect(screen.getByText("No remediation needed")).toBeTruthy();
    expect(screen.queryByText("Misconception found")).toBeNull();
  });

  it("shows a confirmed misconception when remediation actually occurred", () => {
    render(<MasteryChangeCard r={{
      ...base,
      previous: "needs_work",
      diagnosisLabel: "Misconception found",
      misconception: "Parameter probability trap",
      intervention: "1 short lesson",
    }} />);
    expect(screen.getByText("Misconception found")).toBeTruthy();
    expect(screen.getByText("Parameter probability trap")).toBeTruthy();
    expect(screen.getByText("1 short lesson")).toBeTruthy();
  });
});
