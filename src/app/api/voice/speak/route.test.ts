import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const req = (body: unknown) => new Request("http://x/api/voice/speak", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/voice/speak", () => {
  beforeEach(() => { vi.stubEnv("ELEVENLABS_API_KEY", ""); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("is a 501 without a key, so the browser can use its own voice", async () => {
    expect((await POST(req({ text: "hi" }))).status).toBe(501);
  });

  it("rejects empty text", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    expect((await POST(req({ text: "  " }))).status).toBe(400);
  });

  it("proxies audio and keeps the key server side", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "secret");
    const fetchMock = vi.fn(async () => new Response("audio-bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ text: "hello" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(await res.text()).toBe("audio-bytes");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.elevenlabs.io/v1/text-to-speech/");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("secret");
  });

  it("is a 502 when the voice service fails", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    expect((await POST(req({ text: "hello" }))).status).toBe(502);
  });
});
