// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransferChallengeView } from "@proveit/server/store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const transfer = vi.fn();
vi.mock("@proveit/lib/api", () => ({ api: { transfer: (...a: unknown[]) => transfer(...a) } }));
vi.mock("@proveit/lib/settings", () => ({ useSettings: () => [{ showHints: true }] }));

import { TransferFlow } from "./TransferFlow";

const challenge: TransferChallengeView = {
  attemptId: "a1", courseId: "intro-stats", conceptId: "cii", conceptName: "CI interpretation", state: "developing",
  transfer: { question: "100 researchers build 95% intervals. What should happen?", hint: "Think long-run coverage." },
};

beforeEach(() => { push.mockReset(); transfer.mockReset(); });
afterEach(cleanup);

describe("TransferFlow", () => {
  it("keeps an uncertain miss on the transfer screen and shows evaluator feedback", async () => {
    transfer.mockResolvedValue({ result: "fail", failedAttemptId: "a2", nextAttemptId: null, followUp: "Address both parts." });
    render(<TransferFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "Around 95 maybe");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(transfer).toHaveBeenCalledWith("a1", "Around 95 maybe");
    expect(await screen.findByText("Address both parts.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("routes a passing transfer to the mastery result", async () => {
    transfer.mockResolvedValue({ result: "pass", resultAttemptId: "a2" });
    render(<TransferFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "About 95 and one interval either contains it or does not.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(push).toHaveBeenCalledWith("/course/intro-stats/result/a2");
  });

  it("routes a diagnosed transfer failure into the diagnosis/remediation path", async () => {
    transfer.mockResolvedValue({ result: "fail", failedAttemptId: "a2", nextAttemptId: "a2", followUp: null });
    render(<TransferFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "Each interval has a 95% chance.");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(push).toHaveBeenCalledWith("/course/intro-stats/diagnosis/a2");
  });

  it("shows transport/evaluator errors without navigating away", async () => {
    transfer.mockRejectedValue(new Error("The evaluator failed. Retry."));
    render(<TransferFlow r={challenge} />);
    await userEvent.type(screen.getByLabelText("Your answer"), "A complete-looking answer");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("The evaluator failed. Retry.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
