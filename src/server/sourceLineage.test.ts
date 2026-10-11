import { describe, expect, it } from "vitest";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import { learningSourceViews, sourceIdUnion } from "./sourceLineage";

const authored = () => getAuthoredLearningSpec("intro-stats", "cii")!;

function generated(): ConceptLearningSpec {
  const base = authored();
  const id = "material-1";
  return {
    ...base,
    courseId: "runtime-stats",
    conceptId: "runtime-stats-1",
    provenance: { kind: "generated", model: "test-model", generatedAt: "2026-10-10T00:00:00Z" },
    sources: [{
      id,
      kind: "material_excerpt",
      materialId: "m-notes",
      title: "Lecture notes",
      locator: "characters 40-120",
      excerpt: "Repeated confidence-interval procedures capture the fixed parameter at their stated long-run rate.",
    }],
    assessment: { ...base.assessment, sourceIds: [id] },
    misconceptions: base.misconceptions.map((m) => ({ ...m, sourceIds: [id] })),
    remediations: base.remediations.map((r) => ({ ...r, sourceIds: [id] })),
    transfer: { ...base.transfer, sourceIds: [id] },
    review: { ...base.review, sourceIds: [id] },
  };
}

describe("source lineage projection", () => {
  it("keeps authored references explicitly metadata-only", () => {
    const spec = authored();
    expect(learningSourceViews(spec, spec.assessment.sourceIds)).toEqual([{
      id: "authored-cii",
      kind: "authored_reference",
      title: "OpenStax Introductory Statistics 2e",
      locator: "ProveIt Unit 03: Confidence intervals",
      materialId: null,
      excerpt: null,
      retrieved: false,
    }]);
  });

  it("preserves the exact stored excerpt and material identity for generated sources", () => {
    const spec = generated();
    expect(learningSourceViews(spec, spec.assessment.sourceIds)).toEqual([{
      id: "material-1",
      kind: "material_excerpt",
      title: "Lecture notes",
      locator: "characters 40-120",
      materialId: "m-notes",
      excerpt: "Repeated confidence-interval procedures capture the fixed parameter at their stated long-run rate.",
      retrieved: true,
    }]);
  });

  it("deduplicates ordered source unions and fails rather than inventing an unknown citation", () => {
    expect(sourceIdUnion(["a", "b"], ["b", "c"], ["a"])).toEqual(["a", "b", "c"]);
    expect(() => learningSourceViews(authored(), ["missing"])).toThrow(/Unknown learning source/);
  });
});
