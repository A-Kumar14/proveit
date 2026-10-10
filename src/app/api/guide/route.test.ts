import { beforeEach, describe, expect, it, vi } from "vitest";

let ai = true;
const streamText = vi.fn();
vi.mock("@proveit/server/ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));
vi.mock("ai", () => ({
  streamText: (...a: unknown[]) => streamText(...a),
  toTextStream: ({ stream }: { stream: unknown }) => stream,
  createTextStreamResponse: ({ stream }: { stream: ReadableStream }) => new Response(stream),
}));

import { POST } from "./route";

const req = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return new Request("http://x/api/guide", { method: "POST", body: f });
};
const msgs = JSON.stringify([{ role: "user", text: "I don't know yet" }]);
const stream = (...chunks: string[]) => streamText.mockReturnValue({ stream: new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(new TextEncoder().encode(x))); c.close(); } }) });

beforeEach(() => { ai = true; streamText.mockReset(); (globalThis as { __proveit?: unknown }).__proveit = undefined; });

describe("POST /api/guide", () => {
  it("streams the tutor's first step, briefed on the question, and sends only the chat to the model", async () => {
    stream("What do you think ", "the 95 refers to?");
    const res = await POST(req({ courseId: "intro-stats", conceptId: "cii", messages: msgs }));
    expect(await res.text()).toBe("What do you think the 95 refers to?");
    const arg = streamText.mock.calls[0]![0];
    expect(arg.system).toContain("Explain what a 95% confidence interval means.");
    expect(arg.messages).toEqual([{ role: "user", content: "I don't know yet" }]);
  });

  it("keeps the whole conversation in order on later turns", async () => {
    stream("Good.");
    const history = JSON.stringify([{ role: "user", text: "I don't know yet" }, { role: "assistant", text: "What do you think the 95 refers to?" }, { role: "user", text: "How sure I am?" }]);
    await POST(req({ courseId: "intro-stats", conceptId: "cii", messages: history }));
    expect(streamText.mock.calls[0]![0].messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("asks for a concept, an AI key, and a real course and concept", async () => {
    expect((await POST(req({ courseId: "intro-stats", messages: msgs }))).status).toBe(400);
    expect((await POST(req({ courseId: "intro-stats", conceptId: "nope", messages: msgs }))).status).toBe(404);
    expect((await POST(req({ courseId: "nope", conceptId: "cii", messages: msgs }))).status).toBe(404);
    expect((await POST(req({ courseId: "intro-stats", conceptId: "cii", messages: "[]" }))).status).toBe(400);
    ai = false;
    const res = await POST(req({ courseId: "intro-stats", conceptId: "cii", messages: msgs }));
    expect(res.status).toBe(501);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("returns a plain error, not an empty answer, when the model says nothing", async () => {
    streamText.mockReturnValue({ stream: new ReadableStream({ start(c) { c.close(); } }) });
    const res = await POST(req({ courseId: "intro-stats", conceptId: "cii", messages: msgs }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/couldn't answer/);
  });
});
