import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const req = (body: unknown) => new Request("http://x/api/voice/session", { method: "POST", body: JSON.stringify(body) });
const ok = { courseId: "intro-stats", conceptId: "cii" };

describe("POST /api/voice/session", () => {
  beforeEach(() => { vi.stubEnv("ELEVENLABS_API_KEY", "secret"); vi.stubEnv("ELEVENLABS_AGENT_ID", "agent_1"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("is a 501 without a key or agent", async () => {
    vi.stubEnv("ELEVENLABS_AGENT_ID", "");
    expect((await POST(req(ok))).status).toBe(501);
  });

  it("rejects a missing concept and an unknown one", async () => {
    expect((await POST(req({ courseId: "intro-stats" }))).status).toBe(400);
    vi.stubGlobal("fetch", vi.fn());
    expect((await POST(req({ courseId: "intro-stats", conceptId: "nope" }))).status).toBe(404);
  });

  it("returns a token and a brief for the concept, carrying the chat so far", async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes("/token") ? { token: "tok" } : {}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ ...ok, history: [{ role: "user", text: "It means 95% sure" }] }));
    const json = await res.json();
    expect(json.conversationToken).toBe("tok");
    expect(json.prompt).toContain("live spoken call");
    expect(json.prompt).toContain("Student: It means 95% sure");
    expect(json.firstMessage).toContain("picking up");
    const [url, init] = fetchMock.mock.calls.find((c) => String(c[0]).includes("/token")) as unknown as [string, RequestInit];
    expect(url).toContain("agent_id=agent_1");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("secret");
    expect(JSON.stringify(json)).not.toContain("secret");
  });

  it("opens with the concept's own opening on a fresh call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ token: "t" }), { status: 200 })));
    const json = await (await POST(req(ok))).json();
    expect(json.firstMessage).toContain("hear your take");
  });

  it("says what to switch on when the agent doesn't allow overrides", async () => {
    const agent = { platform_settings: { overrides: { conversation_config_override: { agent: { first_message: false, prompt: { prompt: false } } } } } };
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes("/token") ? { token: "t" } : agent), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req(ok));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("Security tab");
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/token"))).toBe(false);
  });

  it("is a 502 when the voice service refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    expect((await POST(req(ok))).status).toBe(502);
  });
});
