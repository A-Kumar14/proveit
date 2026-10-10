import { afterEach, describe, expect, it, vi } from "vitest";
import { streamTutor } from "./tutorStream";

const input = { courseId: "c", messages: [{ role: "user" as const, text: "hi" }], files: [] };
const body = (...chunks: string[]) => new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(new TextEncoder().encode(x))); c.close(); } });
afterEach(() => vi.unstubAllGlobals());

describe("streamTutor", () => {
  it("reports the reply as it grows and resolves with all of it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body("Hel", "lo ", "there"))));
    const seen: string[] = [];
    expect(await streamTutor(input, (t) => seen.push(t))).toBe("Hello there");
    expect(seen[0]).toBe("Hel");
    expect(seen.at(-1)).toBe("Hello there");
  });

  it("posts the messages and files as form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(body("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await streamTutor({ ...input, files: [new File(["x"], "w.png", { type: "image/png" })] }, () => {});
    const sent = fetchMock.mock.calls[0]![1].body as FormData;
    expect(sent.get("courseId")).toBe("c");
    expect(JSON.parse(String(sent.get("messages")))).toEqual(input.messages);
    expect((sent.getAll("files")[0] as File).name).toBe("w.png");
  });

  it("surfaces the server's message on an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "The tutor needs a key." }, { status: 501 })));
    await expect(streamTutor(input, () => {})).rejects.toThrow("The tutor needs a key.");
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    await expect(streamTutor(input, () => {})).rejects.toThrow(/Can't reach the server/);
  });

  it("passes an abort through untouched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("x", "AbortError")));
    await expect(streamTutor(input, () => {})).rejects.toMatchObject({ name: "AbortError" });
  });
});
