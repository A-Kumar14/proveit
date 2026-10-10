import { describe, expect, it } from "vitest";
import { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { getAuthoredLearningSpec, listAuthoredLearningSpecs } from "./authoredLearningSpecs";
import { AUTHORED } from "./content";

const fixture = () => getAuthoredLearningSpec("intro-stats", "cii")!;

describe("canonical authored content", () => {
  it("provides validated JSON-only fixtures for exactly the two supported concepts", () => {
    const specs = listAuthoredLearningSpecs();
    expect(specs.map(s => s.conceptId)).toEqual(["cii", "se"]);
    for (const spec of specs) {
      expect(ConceptLearningSpec.parse(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
      expect(spec.provenance.kind).toBe("authored");
      expect(spec.sources[0].kind).toBe("authored_reference");
      const legacy = AUTHORED[spec.conceptId];
      expect(legacy.question).toBe(spec.assessment.question);
      expect(legacy.correct).toBe(spec.assessment.correctAnswer);
      expect(legacy.lesson.explanation).toBe(spec.remediations[0].explanation);
      expect(legacy.transfer.rubric).toBe(spec.transfer.rubric);
      expect(legacy.review.rubric).toBe(spec.review.rubric);
      expect(legacy.judge(spec.assessment.correctAnswer).verdict).toBe("correct");
      expect(legacy.transfer.judge(spec.transfer.correctAnswer).verdict).toBe("pass");
      expect(legacy.review.judge(spec.review.correctAnswer).verdict).toBe("pass");
    }
  });

  it("resolves course, concept and revision together, without leaking shared mutable content", () => {
    expect(getAuthoredLearningSpec("another-course", "cii")).toBeNull();
    expect(getAuthoredLearningSpec("intro-stats", "pv")).toBeNull();
    expect(getAuthoredLearningSpec("intro-stats", "cii", 2)).toBeNull();
    expect(getAuthoredLearningSpec("intro-stats", "toString")).toBeNull();
    const changed = fixture();
    changed.assessment.question = "Changed";
    changed.misconceptions[0].name = "Changed";
    expect(fixture().assessment.question).toBe("Explain what a 95% confidence interval means.");
    expect(AUTHORED.cii.misconceptions[0].name).toBe("Parameter probability trap");
  });

  it("keeps current misconception and uncertainty outcomes in the offline authored judges", () => {
    expect(AUTHORED.cii.judge("There is a 95% probability that the true mean is inside my interval.")).toMatchObject({ verdict: "incorrect", misconceptionId: "parameter_probability_trap" });
    expect(AUTHORED.se.judge("A larger sample gives more standard error because more people differ.")).toMatchObject({ verdict: "incorrect", misconceptionId: "more_data_more_error" });
    for (const concept of ["cii", "se"]) {
      expect(AUTHORED[concept].judge("unsure").verdict).toBe("uncertain");
      expect(AUTHORED[concept].transfer.judge("unsure").verdict).toBe("uncertain");
      expect(AUTHORED[concept].review.judge("unsure").verdict).toBe("uncertain");
    }
  });
});

describe("learning spec integrity", () => {
  it.each([
    ["unsupported schema version", (s: ConceptLearningSpec) => ({ ...s, schemaVersion: 2 })],
    ["invalid revision", (s: ConceptLearningSpec) => ({ ...s, revision: 0 })],
    ["blank assessment rubric", (s: ConceptLearningSpec) => ({ ...s, assessment: { ...s.assessment, rubric: "  " } })],
    ["missing transfer answer", (s: ConceptLearningSpec) => ({ ...s, transfer: { ...s.transfer, correctAnswer: undefined } })],
    ["executable grader", (s: ConceptLearningSpec) => ({ ...s, judge: () => "pass" })],
    ["learner mastery mixed into content", (s: ConceptLearningSpec) => ({ ...s, mastery: "mastered" })],
    ["unknown source reference", (s: ConceptLearningSpec) => ({ ...s, review: { ...s.review, sourceIds: ["missing"] } })],
    ["duplicate source ID", (s: ConceptLearningSpec) => ({ ...s, sources: [...s.sources, s.sources[0]] })],
    ["duplicate reference", (s: ConceptLearningSpec) => ({ ...s, assessment: { ...s.assessment, sourceIds: [s.sources[0].id, s.sources[0].id] } })],
    ["duplicate misconception ID", (s: ConceptLearningSpec) => ({ ...s, misconceptions: [...s.misconceptions, s.misconceptions[0]] })],
    ["missing remediation", (s: ConceptLearningSpec) => ({ ...s, remediations: [] })],
    ["remediation for unknown misconception", (s: ConceptLearningSpec) => ({ ...s, remediations: [{ ...s.remediations[0], misconceptionId: "missing" }] })],
    ["duplicate remediation", (s: ConceptLearningSpec) => ({ ...s, remediations: [...s.remediations, s.remediations[0]] })],
    ["reused assessment as transfer", (s: ConceptLearningSpec) => ({ ...s, transfer: { ...s.transfer, question: s.assessment.question.toUpperCase() } })],
    ["reused transfer as review", (s: ConceptLearningSpec) => ({ ...s, review: { ...s.review, question: `  ${s.transfer.question.replaceAll(" ", "  ")}  ` } })],
  ])("rejects %s", (_name, mutate) => {
    expect(ConceptLearningSpec.safeParse(mutate(fixture())).success).toBe(false);
  });

  it("requires exactly one targeted remediation for each of multiple misconceptions", () => {
    const spec = fixture();
    spec.misconceptions.push({ ...spec.misconceptions[0], id: "another_trap", name: "Another trap" });
    expect(ConceptLearningSpec.safeParse(spec).success).toBe(false);
    spec.remediations.push({ ...spec.remediations[0], misconceptionId: "another_trap" });
    expect(ConceptLearningSpec.parse(spec).misconceptions).toHaveLength(2);
  });

  it("supports generated content without claiming reference labels are retrieved evidence", () => {
    const spec = fixture();
    spec.courseId = "uploaded-course";
    spec.conceptId = "uploaded-course-1";
    spec.provenance = { kind: "generated", model: "test-model", generatedAt: "2026-10-10T00:00:00Z" };
    expect(ConceptLearningSpec.safeParse(spec).success).toBe(false);
    const source = { id: spec.sources[0].id, kind: "material_excerpt" as const, materialId: "test-material", title: "Test-only notes", locator: "Paragraph 1", excerpt: spec.assessment.correctAnswer };
    spec.sources = [source];
    expect(ConceptLearningSpec.parse(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    // Structural validation is not a test of whether this excerpt actually exists in a user's file.
    source.excerpt = " ";
    expect(ConceptLearningSpec.safeParse(spec).success).toBe(false);
  });
});
