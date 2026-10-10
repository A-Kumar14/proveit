import { afterEach, describe, expect, it, vi } from "vitest";
import { aiEnabled, aiModelId, aiProvider, model } from "./ai";

afterEach(() => vi.unstubAllEnvs());
const env = (or: string, g: string) => { vi.stubEnv("OPENROUTER_API_KEY", or); vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", g); };

describe("ai provider choice", () => {
  it("prefers OpenRouter when its key is set", () => {
    env("sk-or-x", "g-key");
    expect(aiProvider()).toBe("openrouter");
    expect(aiEnabled()).toBe(true);
    expect(aiModelId()).toBe("google/gemini-3.8-flash");
    expect(model()).toMatchObject({ modelId: "google/gemini-3.8-flash" });
  });

  it("uses OPENROUTER_MODEL when set", () => {
    env("sk-or-x", "");
    vi.stubEnv("OPENROUTER_MODEL", "google/gemini-3.1-flash-lite");
    expect(aiModelId()).toBe("google/gemini-3.1-flash-lite");
    expect(model()).toMatchObject({ modelId: "google/gemini-3.1-flash-lite" });
  });

  it("falls back to the Gemini key", () => {
    env("", "g-key");
    expect(aiProvider()).toBe("google");
    expect(aiModelId()).toBe("gemini-3.8-flash");
    expect(model()).toMatchObject({ modelId: "gemini-3.8-flash" });
  });

  it("is off with neither key", () => {
    env("", "");
    expect(aiProvider()).toBeNull();
    expect(aiEnabled()).toBe(false);
  });
});
