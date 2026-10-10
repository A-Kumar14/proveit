// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AttemptView } from "@proveit/server/store";
import { DiagnosisCard } from "./DiagnosisCard";

afterEach(cleanup);

const correct: AttemptView = {
  id: "a1", courseId: "intro-stats", conceptId: "cii", conceptName: "CI interpretation",
  question: "Explain what a 95% confidence interval means.", state: "developing",
  answer: "Over repeated samples, about 95% of intervals contain the mean.", attachment: null,
  kind: "initial", outcome: "correct", parentAttemptId: null, rootAttemptId: "a1", createdAt: 1,
  evaluation: {
    verdict: "correct", errorType: "none", misconceptionId: null, misconceptionName: null,
    evidenceQuote: null, gapSentence: null, skills: [{ label: "Interpretation", pct: 85 }],
    votes: null, followUp: null, recommendation: "Prove it on a different setup.",
  },
};

describe("DiagnosisCard correct path", () => {
  it("routes a sound first answer to transfer verification instead of treating it as mastery", () => {
    render(<DiagnosisCard a={correct} />);
    const link = screen.getByRole("link", { name: "Prove it on a new question" });
    expect(link.getAttribute("href")).toBe("/course/intro-stats/transfer/a1");
    expect(screen.getByRole("link", { name: "Back to course map" })).toBeTruthy();
  });
});
