import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));
const judgeAnswer = vi.fn();
vi.mock("./evaluator", () => ({
  judgeAnswerForSpec: (...a: unknown[]) => judgeAnswer(...a),
  judgeTransferForSpec: vi.fn(),
  judgeReviewForSpec: vi.fn(),
}));

import { audit, nextTurn } from "./converse";
import type { Turn } from "@proveit/lib/schemas";

const Q: Turn = { role: "ai", text: "Explain what a 95% confidence interval means." };
const WRONG = "There is a 95% probability that the true mean is inside my interval.";
const base = { courseId: "intro-stats", conceptId: "cii" };

beforeEach(() => { generateText.mockReset(); judgeAnswer.mockReset(); ai = false; });

describe("nextTurn", () => {
  it("offline, follows the student's own words, then finishes", async () => {
    const t1: Turn[] = [Q, { role: "student", text: WRONG }];
    const a = await nextTurn({ ...base, turns: t1 });
    expect(a).toMatchObject({ kind: "ask" });
    expect(a.kind === "ask" && a.text).toContain("There is a 95% probability that the true");
    const t2: Turn[] = [...t1, { role: "ai", text: "x" }, { role: "student", text: "Because of the sample." }];
    expect((await nextTurn({ ...base, turns: t2 })).kind).toBe("ask");
    const t3: Turn[] = [...t2, { role: "ai", text: "y" }, { role: "student", text: "Like 10 of 100." }];
    expect((await nextTurn({ ...base, turns: t3 })).kind).toBe("done");
  });

  it("with a model, asks its follow-up, but never finishes before one follow-up", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { done: true, question: "" } });
    expect(await nextTurn({ ...base, turns: [Q, { role: "student", text: WRONG }] })).toEqual({ kind: "ask", text: expect.any(String) });
    generateText.mockResolvedValueOnce({ output: { done: false, question: " What does the 95% attach to? " } });
    expect(await nextTurn({ ...base, turns: [Q, { role: "student", text: WRONG }] })).toEqual({ kind: "ask", text: "What does the 95% attach to?" });
  });

  it("stops asking after the follow-up cap without calling the model", async () => {
    ai = true;
    const turns: Turn[] = [Q];
    for (let i = 0; i < 3; i++) turns.push({ role: "student", text: "s" }, { role: "ai", text: "q" });
    turns.push({ role: "student", text: "s" });
    expect(await nextTurn({ ...base, turns })).toEqual({ kind: "done" });
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("audit", () => {
  it("offline, ties the off item to the graded quote and the course material", async () => {
    judgeAnswer.mockResolvedValue({ verdict: "incorrect", quote: "95% probability that the true mean is inside my interval", misconceptionId: "parameter_probability_trap", votes: null });
    const r = await audit({ ...base, turns: [Q, { role: "student", text: WRONG }] });
    expect(r.verdict).toBe("incorrect");
    expect(r.off[0]!.quote).toBe("95% probability that the true mean is inside my interval");
    expect(r.off[0]!.fix).toContain("describes the method");
    expect(r.attemptId).toBeTruthy();
  });

  it("with a model, drops quotes the student never said", async () => {
    ai = true;
    judgeAnswer.mockResolvedValue({ verdict: "incorrect", quote: null, misconceptionId: "parameter_probability_trap", votes: null });
    generateText.mockResolvedValueOnce({ output: {
      right: [{ quote: "made up", note: "n" }, { quote: "the true mean", note: "It is fixed." }],
      off: [{ quote: "also invented", note: "n", fix: "f" }, { quote: "95% probability", note: "n", fix: "f" }],
      missing: ["Repeated sampling"],
    } });
    const r = await audit({ ...base, turns: [Q, { role: "student", text: WRONG }] });
    expect(r.right.map((x) => x.quote)).toEqual(["the true mean"]);
    expect(r.off.map((x) => x.quote)).toEqual(["95% probability"]);
    expect(r.missing).toEqual(["Repeated sampling"]);
  });

  it("rejects a concept with no content", async () => {
    await expect(audit({ courseId: "intro-stats", conceptId: "nope", turns: [Q, { role: "student", text: "x" }] })).rejects.toThrow();
  });
});
