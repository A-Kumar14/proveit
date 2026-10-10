import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = true;
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  Output: { object: (o: unknown) => o },
}));
vi.mock("./ai", () => ({
  aiEnabled: () => ai,
  aiModelId: () => "mock-model",
  model: () => "mock-model",
}));

import {
  buildLearningSourceCandidates,
  ensureLearningSpec,
  generateConceptLearningSpec,
  learningSpecFingerprint,
  LearningSpecGenerationError,
  type LearningSpecGenerationInput,
} from "./learningSpecGenerator";

const input = (text = [
  "Cell membranes regulate what enters and leaves a cell. Selective permeability lets some substances cross more easily than others.",
  "The nucleus stores genetic material. Mitochondria release usable energy from nutrients.",
].join("\n\n")): LearningSpecGenerationInput => ({
  courseId: "biology",
  courseName: "Biology",
  conceptId: "biology-1",
  conceptName: "Cell membrane",
  conceptDescription: "Explain selective transport across the membrane.",
  materials: [{ id: "m1", title: "Week 1 notes", text }],
});

function draft(source = "source-1") {
  return {
    assessment: {
      question: "What role does selective permeability play at the cell membrane?",
      correctAnswer: "It lets some substances cross the cell membrane more easily than others.",
      rubric: "The answer must connect selective permeability with different ease of crossing the membrane.",
      probe: "Does the membrane treat every substance the same way?",
      sourceIds: [source],
    },
    misconceptions: [{
      id: "everything_crosses_equally",
      name: "Everything crosses equally",
      description: "The learner treats the membrane as equally open to every substance.",
      clarificationQuestion: "Do all substances cross with the same ease, or is passage selective?",
      sourceIds: [source],
    }],
    remediations: [{
      misconceptionId: "everything_crosses_equally",
      title: "Membrane transport is selective.",
      actuallyTrue: "Some substances cross more easily than others.",
      explanation: "Selective permeability means the membrane regulates passage rather than treating every substance the same.",
      sourceLabel: "Week 1 notes",
      figure: null,
      sourceIds: [source],
    }],
    transfer: {
      question: "A new substance reaches a cell membrane. What feature of the membrane means its passage may differ from another substance?",
      correctAnswer: "Selective permeability means different substances can cross with different ease.",
      rubric: "Must apply selective permeability to explain why passage can differ between substances.",
      hint: "Think about whether the membrane treats every substance identically.",
      sourceIds: [source],
    },
    review: {
      question: "Without looking at your notes, explain why a cell membrane is not simply an open boundary.",
      correctAnswer: "It regulates entry and exit through selective permeability.",
      rubric: "Must explain regulation or selective permeability, not merely name the membrane.",
      hint: "Focus on what enters and leaves.",
      sourceIds: [source],
    },
    skills: {
      onWrong: { label: "Membrane transport", pct: 30 },
      onRight: { label: "Membrane transport", pct: 85 },
    },
  };
}

beforeEach(() => {
  ai = true;
  generateText.mockReset();
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
});

describe("learning source candidates", () => {
  it("uses exact material excerpts and prioritizes concept-relevant text", () => {
    const sourceText = "Unrelated preface.\n\n" + "x".repeat(1800) + "\n\nCell membrane selective permeability controls what enters and leaves.";
    const i = input(sourceText);
    const candidates = buildLearningSourceCandidates(i);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.excerpt.toLowerCase()).toContain("cell membrane");
    for (const candidate of candidates) {
      const material = i.materials.find((m) => m.id === candidate.materialId)!;
      expect(material.text.trim()).toContain(candidate.excerpt);
      expect(candidate.kind).toBe("material_excerpt");
    }
  });

  it("changes the fingerprint when grounding material changes", () => {
    const a = learningSpecFingerprint(input("Cell membranes regulate entry."));
    const b = learningSpecFingerprint(input("Cell membranes regulate entry and exit."));
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("generated ConceptLearningSpec", () => {
  it("constructs source objects itself and accepts only model-selected source IDs", async () => {
    generateText.mockResolvedValueOnce({ output: draft() });
    const spec = await generateConceptLearningSpec(input(), 1);
    expect(spec).toMatchObject({
      courseId: "biology",
      conceptId: "biology-1",
      revision: 1,
      provenance: { kind: "generated", model: "mock-model" },
    });
    expect(spec.sources).toHaveLength(1);
    expect(spec.sources[0]).toMatchObject({ id: "source-1", kind: "material_excerpt", materialId: "m1", title: "Week 1 notes" });
    expect(spec.sources[0]!.excerpt).toContain("Cell membranes regulate");
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0]![0].prompt).toContain("[source-1]");
  });

  it("rejects an invented source ID instead of laundering it into a citation", async () => {
    generateText.mockResolvedValueOnce({ output: draft("made-up-source") });
    await expect(generateConceptLearningSpec(input(), 1)).rejects.toBeInstanceOf(LearningSpecGenerationError);
  });

  it("refuses generation without an AI key and refuses empty grounding material", async () => {
    ai = false;
    await expect(generateConceptLearningSpec(input(), 1)).rejects.toThrow(/AI key/);
    ai = true;
    await expect(generateConceptLearningSpec({ ...input(), materials: [] }, 1)).rejects.toThrow(/no readable course material/);
  });

  it("reuses an unchanged persisted generation and increments revision when materials change", async () => {
    generateText.mockResolvedValue({ output: draft() });
    const first = await ensureLearningSpec(input());
    const again = await ensureLearningSpec(input());
    expect(first.created).toBe(true);
    expect(first.spec.revision).toBe(1);
    expect(again.created).toBe(false);
    expect(again.spec.revision).toBe(1);
    expect(generateText).toHaveBeenCalledTimes(1);

    const changed = input("Cell membranes regulate what enters and leaves. Selective permeability means substances can cross differently. Extra lecture detail.");
    const regenerated = await ensureLearningSpec(changed);
    expect(regenerated.created).toBe(true);
    expect(regenerated.spec.revision).toBe(2);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("returns canonical authored content without invoking generation", async () => {
    const result = await ensureLearningSpec({
      ...input(),
      courseId: "intro-stats",
      conceptId: "cii",
      courseName: "Intro Statistics",
      conceptName: "CI interpretation",
    });
    expect(result.created).toBe(false);
    expect(result.fingerprint).toBeNull();
    expect(result.spec.provenance.kind).toBe("authored");
    expect(generateText).not.toHaveBeenCalled();
  });
});
