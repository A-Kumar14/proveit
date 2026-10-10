import { beforeEach, describe, expect, it, vi } from "vitest";

const judgeAnswer = vi.fn();
const judgeTransfer = vi.fn();
const judgeReview = vi.fn();
vi.mock("./evaluator", () => ({
  judgeAnswerForSpec: (...args: unknown[]) => judgeAnswer(...args),
  judgeTransferForSpec: (...args: unknown[]) => judgeTransfer(...args),
  judgeReviewForSpec: (...args: unknown[]) => judgeReview(...args),
}));

import { assess } from "./store";

beforeEach(() => {
  judgeAnswer.mockReset();
  judgeTransfer.mockReset();
  judgeReview.mockReset();
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("store clarification context handoff", () => {
  it("passes the prior evidence chain and actual follow-up prompt into the evaluator", async () => {
    judgeAnswer
      .mockResolvedValueOnce({ verdict: "uncertain", quote: null, misconceptionId: null, votes: null })
      .mockResolvedValueOnce({ verdict: "correct", quote: null, misconceptionId: null, votes: null });

    const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "I am not completely sure yet." });
    await assess({
      courseId: "intro-stats", conceptId: "cii",
      answer: "The 95% is about the repeated method.",
      followUpTo: first.attemptId,
    });

    expect(judgeAnswer).toHaveBeenCalledTimes(2);
    const context = judgeAnswer.mock.calls[1]?.[2] as {
      previous: { answer: string; verdict: string; misconceptionId: string | null }[];
      followUpPrompt: string | null;
    };
    expect(context.previous).toEqual([{
      answer: "I am not completely sure yet.",
      verdict: "uncertain",
      misconceptionId: null,
    }]);
    expect(context.followUpPrompt).toContain("Add one more sentence");
  });

  it("does not send episode context on a fresh initial assessment", async () => {
    judgeAnswer.mockResolvedValueOnce({ verdict: "correct", quote: null, misconceptionId: null, votes: null });
    await assess({
      courseId: "intro-stats", conceptId: "cii",
      answer: "Across repeated samples the method has about 95% coverage.",
    });
    expect(judgeAnswer.mock.calls[0]?.[2]).toBeUndefined();
  });
});
