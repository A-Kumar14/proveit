import { afterEach, describe, expect, it, vi } from "vitest";
import { modelErrorMessage } from "./modelError";

afterEach(() => vi.unstubAllEnvs());
const api = (statusCode: number) => Object.assign(new Error("x"), { statusCode });

describe("modelErrorMessage", () => {
  it.each([[401, /rejected the API key/], [403, /rejected the API key/], [402, /out of credits/], [429, /rate limited or out of quota/], [404, /model name/], [503, /having trouble/]])("explains a %i", (status, msg) => {
    expect(modelErrorMessage(api(status))).toMatch(msg);
  });

  it("finds the status inside a retry wrapper", () => {
    expect(modelErrorMessage(Object.assign(new Error("Failed after 3 attempts"), { lastError: api(429) }))).toMatch(/rate limited/);
  });

  it("names the provider that is configured and never repeats the key", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-secret");
    const m = modelErrorMessage(api(401));
    expect(m).toMatch(/^OpenRouter/);
    expect(m).not.toContain("sk-or-secret");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(modelErrorMessage(api(401))).toMatch(/^Gemini/);
  });

  it("uses the caller's fallback for anything else", () => {
    expect(modelErrorMessage(new Error("boom"), "The evaluator failed. Retry.")).toBe("The evaluator failed. Retry.");
    expect(modelErrorMessage(null)).toBe("The AI call failed. Retry.");
  });
});
