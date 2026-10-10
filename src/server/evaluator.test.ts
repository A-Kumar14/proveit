import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => true, model: () => "mock-model" }));

import { judgeAnswer, judgeTransfer } from "./evaluator";

const ANSWER = "It means there's a 95% probability that the true population mean is inside our interval.";
const reply = (...outputs: object[]) => outputs.forEach((output) => generateText.mockResolvedValueOnce({ output }));
const bad = { verdict: "incorrect", misconceptionId: "parameter_probability_trap", evidenceQuote: "a 95% probability that the true population mean is inside" };

beforeEach(() => generateText.mockReset());

describe("judgeAnswer with Gemini", () => {
  it("returns the majority verdict, the vote count and a quote that exists in the answer", async () => {
    reply(bad, bad, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    const j = await judgeAnswer("cii", ANSWER);
    expect(j).toMatchObject({ verdict: "incorrect", votes: { agree: 2, of: 3 } });
    expect(ANSWER.includes(j.quote!)).toBe(true);
  });

  it("drops a quote the model made up", async () => {
    reply({ ...bad, evidenceQuote: "not in the answer" }, bad, bad);
    const j = await judgeAnswer("cii", ANSWER);
    expect(j.quote).toBe(bad.evidenceQuote);
    generateText.mockReset();
    reply({ ...bad, evidenceQuote: "made up" }, { ...bad, evidenceQuote: "made up" }, { ...bad, evidenceQuote: "made up" });
    expect((await judgeAnswer("cii", ANSWER)).quote).toBeNull();
  });

  it("calls a three-way split uncertain instead of guessing", async () => {
    reply(bad, { verdict: "correct", misconceptionId: null, evidenceQuote: null }, { verdict: "uncertain", misconceptionId: null, evidenceQuote: null });
    expect(await judgeAnswer("cii", ANSWER)).toMatchObject({ verdict: "uncertain", quote: null });
  });

  it("surfaces model failures so the UI can offer a retry", async () => {
    generateText.mockResolvedValue({ get output(): never { throw new Error("quota"); } });
    const err = await judgeAnswer("cii", ANSWER).then(() => null, (e: Error) => e);
    expect(err?.message).toBe("quota");
  });
});

describe("judgeTransfer with Gemini", () => {
  it("needs a majority of passing checks", async () => {
    reply({ passes: true }, { passes: false }, { passes: true });
    expect(await judgeTransfer("cii", "x")).toBe(true);
    reply({ passes: true }, { passes: false }, { passes: false });
    expect(await judgeTransfer("cii", "x")).toBe(false);
  });
});
