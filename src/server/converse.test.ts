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
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { createCourse, getCourse } from "./store";
import { saveGeneratedLearningSpec } from "./learningSpecStore";

const Q: Turn = { role: "ai", text: "Explain what a 95% confidence interval means." };
const WRONG = "There is a 95% probability that the true mean is inside my interval.";
const base = { courseId: "intro-stats", conceptId: "cii" };

beforeEach(() => {
  generateText.mockReset();
  judgeAnswer.mockReset();
  ai = false;
  (globalThis as { __proveit?: unknown; __proveitLearningSpecs?: unknown }).__proveit = undefined;
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
});

function generatedBase() {
  const courseId = createCourse({
    name: "Runtime Biology",
    outline: { units: [{ name: "Cells", concepts: [{ name: "Cell membrane", short: "Membrane", desc: "Controls entry and exit." }] }], prerequisites: [] },
    files: [],
  });
  const conceptId = getCourse(courseId).concepts[0]!.id;
  const spec: ConceptLearningSpec = {
    schemaVersion: 1,
    courseId,
    conceptId,
    revision: 1,
    provenance: { kind: "generated", model: "test-model", generatedAt: "2026-10-10T00:00:00Z" },
    sources: [{ id: "src", kind: "material_excerpt", materialId: "m1", title: "Biology notes", locator: "p1", excerpt: "The cell membrane controls what enters and leaves the cell." }],
    assessment: { question: "What does the cell membrane do?", correctAnswer: "It controls what enters and leaves the cell.", rubric: "States the entry/exit role.", probe: "Think about the boundary.", sourceIds: ["src"] },
    misconceptions: [{ id: "stores_dna", name: "Membrane stores DNA", description: "The membrane controls transport, not DNA storage.", clarificationQuestion: "Which role belongs to the membrane?", sourceIds: ["src"] }],
    remediations: [{ misconceptionId: "stores_dna", title: "Separate transport from storage.", actuallyTrue: "The membrane controls entry and exit.", explanation: "Use the boundary role.", sourceLabel: "Biology notes", figure: null, sourceIds: ["src"] }],
    transfer: { question: "Apply the membrane role at a cell boundary.", correctAnswer: "It controls entry and exit.", rubric: "Applies the transport role.", hint: "Boundary.", sourceIds: ["src"] },
    review: { question: "Correct a DNA-storage claim.", correctAnswer: "The membrane controls entry and exit.", rubric: "Rejects storage and states transport.", hint: "Boundary.", sourceIds: ["src"] },
    skills: { onWrong: { label: "Application", pct: 30 }, onRight: { label: "Application", pct: 85 } },
  };
  saveGeneratedLearningSpec(spec, "fixture-fingerprint");
  return { courseId, conceptId, question: spec.assessment.question };
}

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

  it("uses a generated runtime spec as the authority for spoken follow-ups", async () => {
    const runtime = generatedBase();
    ai = true;
    generateText.mockResolvedValueOnce({ output: { done: false, question: "What does that boundary role control?" } });
    const turns: Turn[] = [
      { role: "ai", text: runtime.question },
      { role: "student", text: "It controls material at the boundary." },
    ];
    expect(await nextTurn({ courseId: runtime.courseId, conceptId: runtime.conceptId, turns })).toEqual({
      kind: "ask",
      text: "What does that boundary role control?",
    });
    expect(generateText.mock.calls[0]![0].prompt).toContain("It controls what enters and leaves the cell.");
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

  it("audits a runtime concept against its generated canonical spec", async () => {
    const runtime = generatedBase();
    ai = true;
    judgeAnswer.mockResolvedValue({ verdict: "correct", quote: null, misconceptionId: null, votes: { agree: 3, of: 3 } });
    generateText.mockResolvedValueOnce({ output: {
      right: [{ quote: "controls what enters", note: "Matches the boundary role." }],
      off: [],
      missing: [],
    } });
    const turns: Turn[] = [
      { role: "ai", text: runtime.question },
      { role: "student", text: "The membrane controls what enters and leaves." },
    ];
    const result = await audit({ courseId: runtime.courseId, conceptId: runtime.conceptId, turns });
    expect(result.verdict).toBe("correct");
    expect(result.right.map((x) => x.quote)).toEqual(["controls what enters"]);
    expect(generateText.mock.calls[0]![0].prompt).toContain("It controls what enters and leaves the cell.");
  });

  it("rejects a concept with no content", async () => {
    await expect(audit({ courseId: "intro-stats", conceptId: "nope", turns: [Q, { role: "student", text: "x" }] })).rejects.toThrow();
  });
});
