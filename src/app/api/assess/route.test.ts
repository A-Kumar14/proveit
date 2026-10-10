import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const send = (body: unknown) => POST(new Request("http://x/api/assess", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("POST /api/assess attempt linkage", () => {
  it("returns 409 when a follow-up points at a different concept", async () => {
    const first = await send({ courseId: "intro-stats", conceptId: "cii", answer: "Not sure" });
    expect(first.status).toBe(200);
    const { attemptId } = await first.json() as { attemptId: string };
    const res = await send({ courseId: "intro-stats", conceptId: "se", answer: "Researcher B has the smaller standard error because n is larger.", followUpTo: attemptId });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("follow-up") });
  });

  it("returns 404 for a missing parent and 400 for malformed input", async () => {
    expect((await send({ courseId: "intro-stats", conceptId: "cii", answer: "A valid-length answer here.", followUpTo: "missing" })).status).toBe(404);
    expect((await send({ courseId: "intro-stats", conceptId: "cii", answer: "" })).status).toBe(400);
  });
});
