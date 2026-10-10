import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocked = vi.hoisted(() => ({
  enabled: true,
  generateText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mocked.generateText(...args),
  Output: { object: (value: unknown) => value },
}));

vi.mock("./ai", () => ({
  aiEnabled: () => mocked.enabled,
  aiProvider: () => mocked.enabled ? "google" : null,
  model: () => "mock-model",
}));

import { addCatalogCourse, removeCatalogCourse } from "./courses";
import { closePersistenceForTests } from "./persistence";
import { getCourse, createCourse } from "./store";
import { saveMaterial } from "./materials";
import {
  ensureConceptLearningSpec,
  LearningSpecGenerationError,
} from "./learningSpecGeneration";
import {
  getGeneratedLearningSpec,
  getLearningSpec,
  listGeneratedLearningSpecs,
} from "./learningSpecs";
import { clearUserCachesForTests, runAsUser, scopedUserId } from "./userScope";

type PromptShape = { sources: { id: string }[] };

const draft = (sourceId: string, skillLabel = "Conceptual understanding") => ({
  assessment: {
    question: "What job does the cell membrane perform, and why does that matter for a cell?",
    correctAnswer: "The cell membrane controls what enters and leaves the cell.",
    rubric: "The response must say the membrane controls movement into and out of the cell and connect that role to the cell.",
    probe: "Does the membrane control movement, store DNA, or make ATP?",
    sourceIds: [sourceId],
  },
  misconceptions: [{
    name: "Everything passes freely",
    description: "The learner treats the membrane as if it does not control movement into and out of the cell.",
    clarificationQuestion: "Do you mean every substance crosses freely, or that the membrane controls what enters and leaves?",
    sourceIds: [sourceId],
    remediation: {
      title: "The membrane controls exchange.",
      actuallyTrue: "The cell membrane controls what enters and leaves the cell.",
      explanation: "Think of the membrane as the boundary that regulates exchange rather than an open gap.",
      sourceIds: [sourceId],
    },
  }],
  transfer: {
    question: "A cell is placed in a new environment. Which structure determines what can move into and out of the cell, and what is its role?",
    correctAnswer: "The cell membrane determines and controls what enters and leaves the cell.",
    rubric: "Identifies the cell membrane and explains its control of movement into and out of the cell.",
    hint: "Think about the structure that forms the cell's boundary.",
    sourceIds: [sourceId],
  },
  review: {
    question: "A classmate says the nucleus controls what crosses the cell boundary. Correct the statement and name the structure responsible.",
    correctAnswer: "The cell membrane, not the nucleus, controls what enters and leaves the cell.",
    rubric: "Rejects the nucleus claim and identifies the membrane as controlling movement into and out of the cell.",
    hint: "Separate the structure that holds DNA from the structure at the boundary.",
    sourceIds: [sourceId],
  },
  skillLabel,
});

function installSuccessfulModel() {
  mocked.generateText.mockImplementation(async (options: unknown) => {
    const prompt = JSON.parse((options as { prompt: string }).prompt) as PromptShape;
    return { output: draft(prompt.sources[0]!.id, `Understanding for ${scopedUserId()}`) };
  });
}

function makeRuntimeCourse(name = "Generated Biology") {
  const id = createCourse({
    name,
    outline: {
      units: [{
        name: "Cells",
        concepts: [{
          name: "Cell membrane",
          short: "Membrane",
          desc: "Explain how the cell membrane controls what enters and leaves a cell.",
        }],
      }],
      prerequisites: [],
    },
    files: [{ name: "cells.md", kind: "Notes, uploaded", detail: "Cell notes" }],
  });
  const material = "## Cell membrane\nThe cell membrane controls what enters and leaves the cell. It forms the cell boundary.\n\n## Nucleus\nThe nucleus contains DNA.";
  saveMaterial(id, { name: "cells.md", mime: "text/markdown", size: material.length }, material, "text");
  return { id, conceptId: getCourse(id).concepts[0]!.id, material };
}

let temp: string | null = null;

beforeEach(() => {
  mocked.enabled = true;
  mocked.generateText.mockReset();
  installSuccessfulModel();
  delete process.env.PROVEIT_DB_PATH;
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
  clearUserCachesForTests();
  closePersistenceForTests();
});

afterEach(() => {
  clearUserCachesForTests();
  closePersistenceForTests();
  if (temp) rmSync(temp, { recursive: true, force: true });
  temp = null;
  vi.unstubAllEnvs();
});

describe("course-grounded ConceptLearningSpec generation", () => {
  it("keeps authored gold specs authored and never calls the model for them", async () => {
    const spec = await ensureConceptLearningSpec("intro-stats", "cii");
    expect(spec.provenance.kind).toBe("authored");
    expect(mocked.generateText).not.toHaveBeenCalled();
  });

  it("generates a validated spec from exact saved material excerpts and reuses it while sources are unchanged", async () => {
    const { id, conceptId, material } = makeRuntimeCourse();
    const spec = await ensureConceptLearningSpec(id, conceptId);

    expect(spec).toMatchObject({
      courseId: id,
      conceptId,
      revision: 1,
      provenance: { kind: "generated", model: "google:gemini-3.8-flash" },
    });
    expect(spec.sources).toHaveLength(1);
    expect(spec.sources[0]!.kind).toBe("material_excerpt");
    if (spec.sources[0]!.kind === "material_excerpt") {
      expect(material).toContain(spec.sources[0]!.excerpt);
    }
    expect(getGeneratedLearningSpec(id, conceptId)).toEqual(spec);
    expect(getLearningSpec(id, conceptId)).toEqual(spec);
    expect(mocked.generateText).toHaveBeenCalledTimes(1);

    const again = await ensureConceptLearningSpec(id, conceptId);
    expect(again).toEqual(spec);
    expect(mocked.generateText).toHaveBeenCalledTimes(1);
  });

  it("creates a new immutable revision when the course material changes", async () => {
    const { id, conceptId } = makeRuntimeCourse();
    const first = await ensureConceptLearningSpec(id, conceptId);

    saveMaterial(
      id,
      { name: "more.md", mime: "text/markdown", size: 80 },
      "More course material about the cell membrane and transport across the cell boundary.",
      "text",
    );
    const second = await ensureConceptLearningSpec(id, conceptId);

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(listGeneratedLearningSpecs(id).map((s) => s.revision)).toEqual([1, 2]);
    expect(mocked.generateText).toHaveBeenCalledTimes(2);
  });

  it("rejects hallucinated source references and persists nothing partial", async () => {
    const { id, conceptId } = makeRuntimeCourse();
    mocked.generateText.mockResolvedValueOnce({ output: draft("made-up-source") });

    await expect(ensureConceptLearningSpec(id, conceptId)).rejects.toThrow(/unknown source id/i);
    expect(listGeneratedLearningSpecs(id)).toEqual([]);
  });

  it("requires an AI key for a runtime concept that has not already been generated", async () => {
    const { id, conceptId } = makeRuntimeCourse();
    mocked.enabled = false;

    await expect(ensureConceptLearningSpec(id, conceptId)).rejects.toBeInstanceOf(LearningSpecGenerationError);
    expect(mocked.generateText).not.toHaveBeenCalled();
  });

  it("uses curated course notes as grounding material and deletes specs with the course", async () => {
    expect(addCatalogCourse("personal-finance-101").added).toBe(true);
    const course = getCourse("personal-finance-101");
    const conceptId = course.concepts[0]!.id;

    const spec = await ensureConceptLearningSpec(course.id, conceptId);
    expect(spec.sources.every((s) => s.kind === "material_excerpt")).toBe(true);
    expect(getGeneratedLearningSpec(course.id, conceptId)).not.toBeNull();

    expect(removeCatalogCourse(course.id)).toEqual({ removed: true });
    expect(getGeneratedLearningSpec(course.id, conceptId)).toBeNull();
  });

  it("persists generated specs separately for two users across a database reload", async () => {
    temp = mkdtempSync(join(tmpdir(), "proveit-learning-specs-"));
    vi.stubEnv("PROVEIT_DB_PATH", join(temp, "state.sqlite"));
    closePersistenceForTests();
    clearUserCachesForTests();

    const a = await runAsUser("A", async () => {
      const course = makeRuntimeCourse("Private Biology");
      const spec = await ensureConceptLearningSpec(course.id, course.conceptId);
      return { ...course, label: spec.skills.onWrong.label };
    });
    expect(a.label).toBe("Understanding for A");

    runAsUser("B", () => {
      expect(getGeneratedLearningSpec(a.id, a.conceptId)).toBeNull();
    });

    const b = await runAsUser("B", async () => {
      const course = makeRuntimeCourse("Private Biology");
      const spec = await ensureConceptLearningSpec(course.id, course.conceptId);
      return { ...course, label: spec.skills.onWrong.label };
    });
    expect(b.id).toBe(a.id);
    expect(b.conceptId).toBe(a.conceptId);
    expect(b.label).toBe("Understanding for B");

    clearUserCachesForTests();
    closePersistenceForTests();

    runAsUser("A", () => expect(getGeneratedLearningSpec(a.id, a.conceptId)?.skills.onWrong.label).toBe("Understanding for A"));
    runAsUser("B", () => expect(getGeneratedLearningSpec(b.id, b.conceptId)?.skills.onWrong.label).toBe("Understanding for B"));
  });
});
