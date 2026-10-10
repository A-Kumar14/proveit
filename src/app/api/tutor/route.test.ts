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

const req = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return new Request("http://x/api/tutor", { method: "POST", body: f });
};
const msgs = JSON.stringify([{ role: "user", text: "Explain standard error" }]);
const ok = () => streamText.mockReturnValue({ stream: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("Sure.")); c.close(); } }) });

beforeEach(() => { ai = true; streamText.mockReset(); });

describe("POST /api/tutor", () => {
  it("streams the reply and sends the course context as the system prompt", async () => {
    ok();
    const res = await POST(req({ courseId: "intro-stats", messages: msgs }));
    expect(await res.text()).toBe("Sure.");
    const arg = streamText.mock.calls[0]![0];
    expect(arg.system).toContain("Intro Statistics");
    expect(arg.messages).toEqual([{ role: "user", content: "Explain standard error" }]);
  });

  it("attaches files to the last user message only", async () => {
    ok();
    const history = JSON.stringify([{ role: "user", text: "a" }, { role: "assistant", text: "b" }, { role: "user", text: "see this" }]);
    await POST(req({ courseId: "intro-stats", messages: history, files: new File(["x"], "w.png", { type: "image/png" }) }));
    const m = streamText.mock.calls[0]![0].messages;
    expect(m[0].content).toBe("a");
    expect(m[2].content).toMatchObject([{ type: "text", text: "see this" }, { type: "file", mediaType: "image/png" }]);
  });

  it("returns an error, not an empty 200, when the model ends the stream with nothing", async () => {
    streamText.mockReturnValue({ stream: new ReadableStream({ start(c) { c.close(); } }) });
    const res = await POST(req({ courseId: "intro-stats", messages: msgs }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/busy or rate limited/);
  });

  it("says a key is needed instead of faking a reply", async () => {
    ai = false;
    const res = await POST(req({ courseId: "intro-stats", messages: msgs }));
    expect(res.status).toBe(501);
    expect((await res.json()).error).toMatch(/GOOGLE_GENERATIVE_AI_API_KEY/);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("rejects bad input before calling the model", async () => {
    const res = await POST(req({ courseId: "intro-stats", messages: msgs, files: new File(["x"], "a.exe", { type: "application/x-msdownload" }) }));
    expect(res.status).toBe(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("404s an unknown course", async () => {
    expect((await POST(req({ courseId: "nope", messages: msgs }))).status).toBe(404);
  });
});
