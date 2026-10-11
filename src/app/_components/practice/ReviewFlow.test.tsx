// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewChallengeView } from "@proveit/server/store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const review = vi.fn();
vi.mock("@proveit/lib/api", () => ({ api: { review: (...a: unknown[]) => review(...a) } }));
vi.mock("@proveit/lib/settings", () => ({ useSettings: () => [{ showHints: true }] }));

import { ReviewFlow } from "./ReviewFlow";

const challenge: ReviewChallengeView = {
  courseId: "intro-stats", conceptId: "cii", conceptName: "CI interpretation", state: "provisional", dueDay: "2026-10-10",
  review: { question: "Is the report valid?", hint: "Think repeated samples.", sources: [] },
};

beforeEach(() => { push.mockReset(); review.mockReset(); });
afterEach(cleanup);

describe("ReviewFlow", () => {
  it("routes a pass to the delayed-review result", async () => {
    review.mockResolvedValue({ result: "pass", resultAttemptId: "a9" });
    render(<ReviewFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "No; 95% is about repeated sampling.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(review).toHaveBeenCalledWith("intro-stats", "cii", "No; 95% is about repeated sampling.");
    expect(push).toHaveBeenCalledWith("/course/intro-stats/review-result/a9");
  });

  it("keeps uncertain evidence on the review screen without changing routes", async () => {
    review.mockResolvedValue({ result: "uncertain", attemptId: "a9", followUp: "Explain what 95% refers to." });
    render(<ReviewFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "Probably wrong.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Explain what 95% refers to.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("routes a confirmed review misconception to diagnosis", async () => {
    review.mockResolvedValue({ result: "fail", failedAttemptId: "a9", nextAttemptId: "a9" });
    render(<ReviewFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "It has a 95% chance.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(push).toHaveBeenCalledWith("/course/intro-stats/diagnosis/a9");
  });

  it("surfaces API/evaluator errors without navigating", async () => {
    review.mockRejectedValue(new Error("The evaluator failed. Retry."));
    render(<ReviewFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "A complete answer.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("The evaluator failed. Retry.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
