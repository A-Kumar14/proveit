import "server-only";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { listAuthoredLearningSpecs } from "./authoredLearningSpecs";
import { AUTHORED_JUDGES, type AuthoredJudges } from "./authoredJudges";

export type { TransferSeed } from "./authoredJudges";
export type Misconception = { id: string; name: string; gap: string; clarify: string };

/**
 * Compatibility view for the current store/evaluator. All content comes from the canonical spec;
 * offline grading functions remain authored-only. Generalized evaluation is a later milestone.
 */
function legacyView(spec: ConceptLearningSpec, judges: AuthoredJudges) {
  // Both current fixtures have one misconception. Future multi-remediation consumers must select
  // by misconceptionId rather than using this legacy single-lesson field.
  const remediation = spec.remediations.find((r) => r.misconceptionId === spec.misconceptions[0].id)!;
  return {
    correct: spec.assessment.correctAnswer,
    probe: spec.assessment.probe,
    question: spec.assessment.question,
    misconceptions: spec.misconceptions.map((m): Misconception => ({ id: m.id, name: m.name, gap: m.description, clarify: m.clarificationQuestion })),
    judge: judges.assessment,
    lesson: {
      title: remediation.title,
      actuallyTrue: remediation.actuallyTrue,
      explanation: remediation.explanation,
      rule: remediation.sourceLabel,
      figure: remediation.figure,
    },
    transfer: { question: spec.transfer.question, hint: spec.transfer.hint, rubric: spec.transfer.rubric, judge: judges.transfer },
    review: { question: spec.review.question, hint: spec.review.hint, rubric: spec.review.rubric, judge: judges.review },
    skillOnWrong: spec.skills.onWrong,
    skillOnRight: spec.skills.onRight,
  };
}
export type Authored = ReturnType<typeof legacyView>;

export const AUTHORED: Record<string, Authored> = Object.fromEntries(
  listAuthoredLearningSpecs().map((spec) => {
    const judges = AUTHORED_JUDGES[spec.conceptId];
    if (!judges) throw new Error(`Missing authored judges for ${spec.conceptId}`);
    return [spec.conceptId, legacyView(spec, judges)];
  }),
);
