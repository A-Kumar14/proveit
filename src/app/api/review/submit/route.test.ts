import { beforeEach, describe, expect, it } from "vitest";
import { assess, submitTransfer } from "@proveit/server/store";
import { POST } from "./route";

const RIGHT_TRANSFER = "About 95 of them. But for any one interval that's already calculated, there's no 95% chance. It either contains the mean or it doesn't.";
const REVIEW_PASS = "The report is invalid. A finished interval does not have a 95% probability; 95% describes the long-run repeated-sampling method.";
const send = (body: unknown) => POST(new Request("http://x/api/review/submit", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

async function makeDue() {
  const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Across repeated samples, about 95% of intervals from the method contain the true mean." });
  const transfer = await submitTransfer(first.attemptId, RIGHT_TRANSFER);
  if (transfer.result !== "pass") throw new Error("expected transfer pass");
  const concept = (globalThis as unknown as { __proveit: { course: { concepts: { id: string; nextReview: string | null }[] } } }).__proveit.course.concepts.find((c) => c.id === "cii");
  concept!.nextReview = "2000-01-01";
}

describe("POST /api/review/submit", () => {
  it("promotes a due provisional concept after a passing delayed review", async () => {
    await makeDue();
    const res = await send({ courseId: "intro-stats", conceptId: "cii", answer: REVIEW_PASS });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "pass", resultAttemptId: expect.any(String) });
  });

  it("keeps incomplete review evidence distinct from a misconception", async () => {
    await makeDue();
    const res = await send({ courseId: "intro-stats", conceptId: "cii", answer: "Probably invalid." });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "uncertain", attemptId: expect.any(String), followUp: expect.any(String) });
  });

  it("routes a known misconception back into diagnosis/remediation", async () => {
    await makeDue();
    const res = await send({ courseId: "intro-stats", conceptId: "cii", answer: "The report is valid because a finished interval has a 95% probability of containing the mean." });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "fail", failedAttemptId: expect.any(String), nextAttemptId: expect.any(String) });
  });

  it("returns 409 when a review is not due and 400 for malformed input", async () => {
    expect((await send({ courseId: "intro-stats", conceptId: "cii", answer: REVIEW_PASS })).status).toBe(409);
    expect((await send({ courseId: "intro-stats", conceptId: "cii", answer: "" })).status).toBe(400);
  });
});
