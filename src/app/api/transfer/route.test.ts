import { beforeEach, describe, expect, it } from "vitest";
import { assess } from "@proveit/server/store";
import { POST } from "./route";

const send = (body: unknown) => POST(new Request("http://x/api/transfer", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("POST /api/transfer", () => {
  it("lets a correct first answer prove transfer and returns a result attempt", async () => {
    const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Across repeated samples, about 95% of intervals from the method contain the true mean." });
    const res = await send({ attemptId: first.attemptId, answer: "About 95 of 100; once one interval is calculated it either contains the fixed mean or it does not." });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "pass", resultAttemptId: expect.any(String) });
  });

  it("persists an incomplete transfer as a failed evidence event with follow-up feedback", async () => {
    const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Across repeated samples, about 95% of intervals from the method contain the true mean." });
    const res = await send({ attemptId: first.attemptId, answer: "Around 95 maybe" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "fail", failedAttemptId: expect.any(String), nextAttemptId: null, followUp: expect.any(String) });
  });

  it("returns a diagnosis attempt when the transfer clearly repeats a known misconception", async () => {
    const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Across repeated samples, about 95% of intervals from the method contain the true mean." });
    const res = await send({ attemptId: first.attemptId, answer: "Each finished interval still has a 95% chance of containing the mean." });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: "fail", failedAttemptId: expect.any(String), nextAttemptId: expect.any(String), followUp: null });
  });

  it("rejects a duplicate transfer after the episode already passed", async () => {
    const first = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Across repeated samples, about 95% of intervals from the method contain the true mean." });
    const answer = "About 95 of 100; one calculated interval either contains the fixed mean or it does not.";
    expect((await send({ attemptId: first.attemptId, answer })).status).toBe(200);
    expect((await send({ attemptId: first.attemptId, answer })).status).toBe(409);
  });

  it("rejects missing attempts and malformed answers", async () => {
    expect((await send({ attemptId: "missing", answer: "valid answer" })).status).toBe(404);
    expect((await send({ attemptId: "a1", answer: "" })).status).toBe(400);
  });
});
