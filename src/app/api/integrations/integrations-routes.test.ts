import { beforeEach, describe, expect, it, vi } from "vitest";

const completeConnect = vi.fn();
const beginConnect = vi.fn();
vi.mock("@proveit/server/auth", async (orig) => ({ ...(await orig<typeof import("@proveit/server/auth")>()), currentUserId: async () => "u1" }));
vi.mock("@proveit/server/integrations", async (orig) => ({ ...(await orig<typeof import("@proveit/server/integrations")>()), completeConnect: (...a: unknown[]) => completeConnect(...a), beginConnect: (...a: unknown[]) => beginConnect(...a) }));

import { GET as callback } from "./[provider]/callback/route";
import { POST as connect } from "./[provider]/connect/route";

const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) }) as never;
beforeEach(() => { completeConnect.mockReset(); beginConnect.mockReset(); });

describe("GET /api/integrations/[provider]/callback", () => {
  it("returns the student to where they started, marked as connected", async () => {
    completeConnect.mockResolvedValue({ returnTo: "/?add=1" });
    const res = await callback(new Request("http://localhost:3000/api/integrations/granola/callback?code=abc&state=s1"), ctx("granola"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/?add=1&connected=granola");
    expect(completeConnect).toHaveBeenCalledWith("u1", "granola", "http://localhost:3000", "abc", "s1");
  });

  it("explains a cancelled sign-in instead of failing silently", async () => {
    const res = await callback(new Request("http://localhost:3000/api/integrations/granola/callback?error=access_denied"), ctx("granola"));
    expect(new URL(res.headers.get("location")!).searchParams.get("integration_error")).toBe("You cancelled the connection.");
    expect(completeConnect).not.toHaveBeenCalled();
  });

  it("sends a forged or expired link back with a message", async () => {
    const { MaterialError } = await import("@proveit/server/materials");
    completeConnect.mockRejectedValue(new MaterialError("That sign-in link is out of date. Start the connection again."));
    const res = await callback(new Request("http://localhost:3000/api/integrations/wispr/callback?code=abc&state=bad"), ctx("wispr"));
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/account");
    expect(to.searchParams.get("integration_error")).toContain("out of date");
  });

  it("ignores an unknown provider", async () => {
    const res = await callback(new Request("http://localhost:3000/api/integrations/evil/callback?code=x"), ctx("evil"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/account");
    expect(completeConnect).not.toHaveBeenCalled();
  });
});

describe("POST /api/integrations/[provider]/connect", () => {
  const post = (provider: string, body: unknown) => connect(new Request(`http://localhost:3000/api/integrations/${provider}/connect`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), ctx(provider));

  it("returns the provider's sign-in page", async () => {
    beginConnect.mockResolvedValue({ url: "https://auth.example/authorize" });
    const res = await post("granola", { returnTo: "/?add=1" });
    expect(await res.json()).toEqual({ url: "https://auth.example/authorize" });
    expect(beginConnect).toHaveBeenCalledWith("u1", "granola", "http://localhost:3000", "/?add=1");
  });

  it("404s an unknown provider and never calls out", async () => {
    expect((await post("evil", {})).status).toBe(404);
    expect(beginConnect).not.toHaveBeenCalled();
  });

  it("gives a plain message when the provider can't be reached", async () => {
    beginConnect.mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));
    const res = await post("wispr", {});
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Couldn't reach Wispr Flow. Retry in a moment.");
  });
});
