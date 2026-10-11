import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const send = (fields: Record<string, string | File>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return POST(new Request("http://x/api/upload/check", { method: "POST", body: form }));
};
const png = (bytes = 10) => new File([new Uint8Array(bytes)], "work.png", { type: "image/png" });

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

describe("POST /api/upload/check", () => {
  it("requires course identity and rejects unknown courses even for an authored concept", async () => {
    expect((await send({ conceptId: "cii", file: png() })).status).toBe(400);
    expect((await send({ courseId: "someone-elses-course", conceptId: "cii", file: png() })).status).toBe(404);
  });
  it("rejects a missing file, wrong type and oversize images before any model call", async () => {
    expect((await send({ courseId: "intro-stats", conceptId: "cii" })).status).toBe(400);
    expect((await send({ courseId: "intro-stats", conceptId: "cii", file: new File(["x"], "a.pdf", { type: "application/pdf" }) })).status).toBe(400);
    expect((await send({ courseId: "intro-stats", conceptId: "cii", file: png(5 * 1024 * 1024 + 1) })).status).toBe(400);
  });

  it("404s on a concept with no content", async () => {
    expect((await send({ courseId: "intro-stats", conceptId: "pv", file: png() })).status).toBe(404);
  });

  it("refuses with 501 when no model key is set, so nothing is waved through", async () => {
    expect((await send({ courseId: "intro-stats", conceptId: "cii", file: png() })).status).toBe(501);
  });
});

