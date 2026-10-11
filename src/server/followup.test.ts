import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = true;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { followUpFor, GENERIC_FOLLOWUP } from "./followup";

beforeEach(() => { ai = true; generateText.mockReset(); });

describe("followUpFor", () => {
  it("builds on what the student wrote, and shows the model the question and their words", async () => {
    generateText.mockResolvedValueOnce({ text: "  You said it tells you how sure you are. Sure about what, exactly?  " });
    const r = await followUpFor("Explain what a 95% confidence interval means.", "It tells you how sure you are.");
    expect(r).toBe("You said it tells you how sure you are. Sure about what, exactly?");
    const arg = generateText.mock.calls[0]![0];
    expect(arg.prompt).toContain("Explain what a 95% confidence interval means.");
    expect(arg.prompt).toContain("how sure you are");
    expect(arg.system).toMatch(/Never state the correct answer/);
  });

  it("falls back to the fixed prompt with no model, no question, a failed call or a useless reply", async () => {
    ai = false;
    expect(await followUpFor("Explain it.", "x")).toBe(GENERIC_FOLLOWUP);
    ai = true;
    expect(await followUpFor("", "x")).toBe(GENERIC_FOLLOWUP);
    generateText.mockRejectedValueOnce(new Error("429"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await followUpFor("Explain it.", "x")).toBe(GENERIC_FOLLOWUP);
    generateText.mockResolvedValueOnce({ text: "ok" });
    expect(await followUpFor("Explain it.", "x")).toBe(GENERIC_FOLLOWUP);
    generateText.mockResolvedValueOnce({ text: "q ".repeat(300) });
    expect(await followUpFor("Explain it.", "x")).toBe(GENERIC_FOLLOWUP);
  });
});
