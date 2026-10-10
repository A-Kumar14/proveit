import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("proxy", () => {
  it("lets every request through when accounts are off", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const { default: proxy, config } = await import("./proxy");
    const res = await (proxy as (r: Request) => Promise<Response> | Response)(new Request("http://localhost/courses"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(config.matcher).toHaveLength(2);
  });
});
