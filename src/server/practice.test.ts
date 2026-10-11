import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));
const compile = vi.fn();
vi.mock("./latex", async (orig) => ({ ...(await orig<typeof import("./latex")>()), compile: (...a: unknown[]) => compile(...a) }));

import { getWeakness, samplePaper, studyNotes } from "./practice";
import { esc } from "./latex";
import { createCourse, getCourse, recordQuizEvidence } from "./store";
import { saveGeneratedLearningSpec } from "./learningSpecStore";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";

beforeEach(() => {
  generateText.mockReset();
  compile.mockReset();
  ai = false;
  compile.mockResolvedValue(Buffer.from("%PDF"));
  (globalThis as { __proveit?: unknown; __proveitLearningSpecs?: unknown }).__proveit = undefined;
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
});

function generatedCourse() {
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
    assessment: { question: "What does the cell membrane control?", correctAnswer: "It controls what enters and leaves the cell.", rubric: "States the entry/exit role.", probe: "Think about the cell boundary.", sourceIds: ["src"] },
    misconceptions: [{ id: "stores_dna", name: "Membrane stores DNA", description: "The membrane controls transport, not DNA storage.", clarificationQuestion: "Which role belongs to the membrane?", sourceIds: ["src"] }],
    remediations: [{ misconceptionId: "stores_dna", title: "Separate transport from storage.", actuallyTrue: "The membrane controls entry and exit.", explanation: "Use the boundary role from the notes.", sourceLabel: "Biology notes", figure: null, sourceIds: ["src"] }],
    transfer: { question: "How does the membrane matter when a molecule reaches the cell boundary?", correctAnswer: "It controls whether material enters or leaves.", rubric: "Applies the transport role.", hint: "Think boundary.", sourceIds: ["src"] },
    review: { question: "Correct someone who says the membrane stores DNA.", correctAnswer: "It controls entry and exit instead.", rubric: "Rejects DNA storage and states transport.", hint: "Recall the boundary.", sourceIds: ["src"] },
    skills: { onWrong: { label: "Application", pct: 30 }, onRight: { label: "Application", pct: 85 } },
  };
  saveGeneratedLearningSpec(spec, "fixture-fingerprint");
  return { courseId, conceptId };
}

describe("getWeakness", () => {
  it("flags needs-work concepts and attaches the open mistake with its fix", () => {
    const w = getWeakness("intro-stats");
    const cii = w.concepts.find((c) => c.id === "cii")!;
    expect(cii.weak).toBe(true);
    expect(cii.mistakes[0]).toMatchObject({ name: expect.any(String), gap: expect.any(String) });
    expect(w.concepts.some((c) => !c.weak)).toBe(true);
  });

  it("uses generated specs as course truth and a low quiz score only as a weakness signal", () => {
    const { courseId, conceptId } = generatedCourse();
    let concept = getWeakness(courseId).concepts[0]!;
    expect(concept.material).toBe("It controls what enters and leaves the cell.");
    expect(concept.weak).toBe(false);

    recordQuizEvidence(courseId, [{ conceptId, prompt: "Boundary?", selected: "Stores DNA", correct: false }]);
    concept = getWeakness(courseId).concepts[0]!;
    expect(concept.state).toBe("developing");
    expect(concept.weak).toBe(true);
  });
});

describe("samplePaper", () => {
  it("offline, returns a paper and a separate key with one answer per question", async () => {
    const r = await samplePaper("intro-stats");
    expect(r.docs.map((d) => d.name)).toEqual(["question-paper", "answer-key"]);
    expect(r.docs.every((d) => d.pdf === Buffer.from("%PDF").toString("base64"))).toBe(true);
    const qs = (r.docs[0]!.tex.match(/\\item\[\\textbf\{Q\d+\./g) ?? []).length;
    expect(qs).toBe(10);
    expect((r.docs[1]!.tex.match(/\\textbf\{Answer\.\}/g) ?? []).length).toBe(qs);
    expect(r.docs[0]!.tex).not.toContain("Answer.");
    expect(r.pdfError).toBeNull();
  });

  it("puts the weak concept first and asks it twice", async () => {
    const tex = (await samplePaper("intro-stats")).docs[0]!.tex;
    expect((tex.match(/95\\% confidence interval/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("uses a generated learning spec for offline paper questions and keys", async () => {
    const { courseId } = generatedCourse();
    const r = await samplePaper(courseId);
    expect(r.docs[0]!.tex).toContain("What does the cell membrane control?");
    expect(r.docs[1]!.tex).toContain("It controls what enters and leaves the cell.");
  });

  it("returns the .tex and an error when the compile fails", async () => {
    compile.mockRejectedValue(Object.assign(new Error("x"), { code: "ENOENT" }));
    const r = await samplePaper("intro-stats");
    expect(r.docs.every((d) => d.pdf === null && d.tex.includes("\\begin{document}"))).toBe(true);
    expect(r.pdfError).toContain("tectonic");
  });

  it("with a model, rejects a key that doesn't match the questions", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { title: "T", questions: [{ concept: "a", prompt: "p", marks: 5 }], key: [] } });
    await expect(samplePaper("intro-stats")).rejects.toThrow(/key/);
  });
});

describe("studyNotes", () => {
  it("lists the open mistake with what the student said and how to fix it", async () => {
    const tex = (await studyNotes("intro-stats")).docs[0]!.tex;
    expect(tex).toContain("What you keep getting wrong");
    expect(tex).toContain("How to fix it.");
  });

  it("with a model, keeps the course's concept order and falls back for concepts the model skipped", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: { sections: [{ concept: "CI interpretation", summary: "From the model.", points: ["p1"] }] } });
    const tex = (await studyNotes("intro-stats")).docs[0]!.tex;
    expect(tex).toContain("From the model.");
    expect(tex.indexOf("CI interpretation")).toBeGreaterThan(-1);
    expect(tex).toContain("Standard error");
  });
});

describe("esc", () => {
  it("neutralises LaTeX control characters", () => {
    expect(esc("\\input{/etc/passwd} 50% & $x_1$ #a ~ ^")).toBe("\\textbackslash{}input\\{/etc/passwd\\} 50\\% \\& \\$x\\_1\\$ \\#a \\textasciitilde{} \\textasciicircum{}");
  });
});
