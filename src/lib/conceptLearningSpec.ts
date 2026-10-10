import { z } from "zod";

const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(8000);
const sourceIds = z.array(id).min(1).max(32);
const skill = z.object({ label: text, pct: z.number().min(0).max(100) }).strict();

/** A reference label is not a retrieved quotation. Generated content requires material excerpts. */
export const LearningSource = z.discriminatedUnion("kind", [
  z.object({ id, kind: z.literal("authored_reference"), title: text, locator: text.nullable() }).strict(),
  z.object({ id, kind: z.literal("material_excerpt"), materialId: id, title: text, locator: text.nullable(), excerpt: text }).strict(),
]);

const challenge = z.object({
  question: text,
  correctAnswer: text,
  rubric: text,
  hint: text,
  sourceIds,
}).strict();

export const LearningSpecRef = z.object({ courseId: id, conceptId: id, revision: z.number().int().positive() }).strict();
export type LearningSpecRef = z.infer<typeof LearningSpecRef>;

/**
 * Versioned, JSON-only teaching and assessment content. It contains no learner state or grading code.
 * Validation checks structural integrity; it does not prove factual grounding or pedagogical quality.
 */
export const ConceptLearningSpec = z.object({
  schemaVersion: z.literal(1),
  ...LearningSpecRef.shape,
  provenance: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("authored") }).strict(),
    z.object({ kind: z.literal("generated"), model: text, generatedAt: z.iso.datetime() }).strict(),
  ]),
  sources: z.array(LearningSource).min(1).max(32),
  assessment: z.object({ question: text, correctAnswer: text, rubric: text, probe: text, sourceIds }).strict(),
  misconceptions: z.array(z.object({
    id, name: text, description: text, clarificationQuestion: text, sourceIds,
  }).strict()).min(1).max(12),
  remediations: z.array(z.object({
    misconceptionId: id,
    title: text,
    actuallyTrue: text,
    explanation: text,
    sourceLabel: text.nullable(),
    figure: z.enum(["ci-intervals"]).nullable(),
    sourceIds,
  }).strict()).min(1).max(12),
  transfer: challenge,
  review: challenge,
  skills: z.object({ onWrong: skill, onRight: skill }).strict(),
}).strict().superRefine((spec, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const sources = new Set<string>();
  spec.sources.forEach((source, i) => {
    if (sources.has(source.id)) issue(["sources", i, "id"], "Source IDs must be unique.");
    sources.add(source.id);
    if (spec.provenance.kind === "generated" && source.kind !== "material_excerpt") {
      issue(["sources", i, "kind"], "Generated specs need material excerpts, not reference labels.");
    }
  });
  const references = (ids: string[], path: (string | number)[]) => {
    const seen = new Set<string>();
    ids.forEach((source, i) => {
      if (!sources.has(source)) issue([...path, i], "Unknown source ID.");
      if (seen.has(source)) issue([...path, i], "Duplicate source reference.");
      seen.add(source);
    });
  };
  references(spec.assessment.sourceIds, ["assessment", "sourceIds"]);
  references(spec.transfer.sourceIds, ["transfer", "sourceIds"]);
  references(spec.review.sourceIds, ["review", "sourceIds"]);

  const misconceptions = new Set<string>();
  spec.misconceptions.forEach((m, i) => {
    if (misconceptions.has(m.id)) issue(["misconceptions", i, "id"], "Misconception IDs must be unique.");
    misconceptions.add(m.id);
    references(m.sourceIds, ["misconceptions", i, "sourceIds"]);
  });
  const repaired = new Set<string>();
  spec.remediations.forEach((r, i) => {
    if (!misconceptions.has(r.misconceptionId)) issue(["remediations", i, "misconceptionId"], "Unknown misconception ID.");
    if (repaired.has(r.misconceptionId)) issue(["remediations", i, "misconceptionId"], "Each misconception has exactly one remediation.");
    repaired.add(r.misconceptionId);
    references(r.sourceIds, ["remediations", i, "sourceIds"]);
  });
  spec.misconceptions.forEach((m, i) => {
    if (!repaired.has(m.id)) issue(["misconceptions", i, "id"], "Missing targeted remediation.");
  });

  const normalized = (question: string) => question.toLowerCase().replace(/\s+/g, " ").trim();
  const questions = [spec.assessment.question, spec.transfer.question, spec.review.question].map(normalized);
  if (new Set(questions).size !== questions.length) {
    issue(["transfer", "question"], "Assessment, transfer and review must use distinct questions.");
  }
});
export type ConceptLearningSpec = z.infer<typeof ConceptLearningSpec>;
export type LearningSource = z.infer<typeof LearningSource>;
