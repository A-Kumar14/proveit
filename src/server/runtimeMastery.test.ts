import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";

const ensureSpec = vi.fn();
const judgeAnswerForSpec = vi.fn();
const judgeTransferForSpec = vi.fn();
const judgeReviewForSpec = vi.fn();

vi.mock("./learningSpecGenerator", () => ({
  ensureConceptLearningSpec: (...args: unknown[]) => ensureSpec(...args),
}));
vi.mock("./evaluator", () => ({
  judgeAnswerForSpec: (...args: unknown[]) => judgeAnswerForSpec(...args),
  judgeTransferForSpec: (...args: unknown[]) => judgeTransferForSpec(...args),
  judgeReviewForSpec: (...args: unknown[]) => judgeReviewForSpec(...args),
}));

import {
  assess,
  createCourse,
  ensureQuestion,
  getCourse,
  getEvidenceAttempt,
  getMisconceptionLog,
  getRemediation,
  getResult,
  getReviewChallenge,
  getReviewResult,
  getReviews,
  getTodos,
  getTransferChallenge,
  submitReview,
  submitTransfer,
} from "./store";
import { getGeneratedLearningSpec, saveGeneratedLearningSpec } from "./learningSpecStore";

function specFor(courseId: string, conceptId: string, revision = 1): ConceptLearningSpec {
  return {
    schemaVersion: 1,
    courseId,
    conceptId,
    revision,
    provenance: { kind: "generated", model: "test-model", generatedAt: `2026-10-10T00:0${revision}:00Z` },
    sources: [{
      id: "bio-source",
      kind: "material_excerpt",
      materialId: "bio-notes",
      title: "Biology notes",
      locator: revision === 1 ? "paragraph 1" : "paragraph 2",
      excerpt: revision === 1
        ? "The cell membrane controls what enters and leaves the cell."
        : "Revision two says the membrane selectively regulates movement across the cell boundary.",
    }],
    assessment: {
      question: revision === 1 ? "What does the cell membrane do?" : "Explain the membrane's role.",
      correctAnswer: "It controls what enters and leaves the cell.",
      rubric: "Says that the membrane controls movement into and out of the cell.",
      probe: "Does the membrane control movement, store DNA, or make ATP?",
      sourceIds: ["bio-source"],
    },
    misconceptions: [{
      id: "membrane_stores_dna",
      name: "Membrane stores DNA",
      description: "The membrane controls transport; it does not store the cell's DNA.",
      clarificationQuestion: "Did you mean the membrane controls transport, or that it stores DNA?",
      sourceIds: ["bio-source"],
    }],
    remediations: [{
      misconceptionId: "membrane_stores_dna",
      title: "Separate transport from DNA storage.",
      actuallyTrue: "The membrane controls what enters and leaves.",
      explanation: "Use the membrane for the boundary/transport role described in the notes.",
      sourceLabel: "Biology notes",
      figure: null,
      sourceIds: ["bio-source"],
    }],
    transfer: {
      question: "A molecule approaches a cell boundary. What membrane role matters here?",
      correctAnswer: "The membrane controls whether material enters or leaves.",
      rubric: "Applies the membrane's transport role to the new setup.",
      hint: "Think about the cell boundary.",
      sourceIds: ["bio-source"],
    },
    review: {
      question: "A classmate says the membrane's main job is storing DNA. Correct them.",
      correctAnswer: "The membrane controls entry and exit; DNA storage is not its role.",
      rubric: "Rejects DNA storage and states the transport/boundary role.",
      hint: "Recall what crosses the cell boundary.",
      sourceIds: ["bio-source"],
    },
    skills: {
      onWrong: { label: "Application", pct: 30 },
      onRight: { label: "Application", pct: 85 },
    },
  };
}

function runtimeCourse() {
  const courseId = createCourse({
    name: "Biology",
    outline: {
      units: [{ name: "Cells", concepts: [{ name: "Cell membrane", short: "Membrane", desc: "Controls what enters and leaves." }] }],
      prerequisites: [],
    },
    files: [],
  });
  const conceptId = getCourse(courseId).concepts[0]!.id;
  const spec = specFor(courseId, conceptId);
  saveGeneratedLearningSpec(spec, "fp-1");
  ensureSpec.mockImplementation(async (c: string, id: string) => getGeneratedLearningSpec(c, id)!);
  return { courseId, conceptId, spec };
}

beforeEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  (globalThis as { __proveit?: unknown; __proveitLearningSpecs?: unknown }).__proveit = undefined;
  (globalThis as { __proveitLearningSpecs?: unknown }).__proveitLearningSpecs = undefined;
  ensureSpec.mockReset();
  judgeAnswerForSpec.mockReset();
  judgeTransferForSpec.mockReset();
  judgeReviewForSpec.mockReset();

  judgeAnswerForSpec.mockImplementation(async (_spec: ConceptLearningSpec, answer: string) =>
    answer.includes("stores DNA")
      ? { verdict: "incorrect", quote: "stores DNA", misconceptionId: "membrane_stores_dna", votes: { agree: 3, of: 3 } }
      : { verdict: "correct", quote: null, misconceptionId: null, votes: { agree: 3, of: 3 } }
  );
  judgeTransferForSpec.mockImplementation(async (_spec: ConceptLearningSpec, answer: string) =>
    answer.includes("transfer pass")
      ? { verdict: "pass", quote: null, misconceptionId: null, feedback: null, votes: { agree: 3, of: 3 } }
      : { verdict: "fail", quote: "stores DNA", misconceptionId: "membrane_stores_dna", feedback: "Recheck the membrane's role.", votes: { agree: 3, of: 3 } }
  );
  judgeReviewForSpec.mockImplementation(async (_spec: ConceptLearningSpec, answer: string) =>
    answer.includes("review pass")
      ? { verdict: "pass", quote: null, misconceptionId: null, feedback: null, votes: { agree: 3, of: 3 } }
      : { verdict: "fail", quote: "stores DNA", misconceptionId: "membrane_stores_dna", feedback: "Recheck the membrane's role.", votes: { agree: 3, of: 3 } }
  );
});

afterEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});

describe("runtime course mastery", () => {
  it("exposes runtime concepts as practiceable and resolves their generated question", async () => {
    const { courseId, conceptId } = runtimeCourse();
    expect(getCourse(courseId).concepts[0]!.cta).toEqual({
      label: "Start this concept",
      href: `/course/${courseId}/practice/${conceptId}`,
    });
    const q = await ensureQuestion(courseId, conceptId);
    expect(q).toMatchObject({ courseName: "Biology", conceptId, prompt: "What does the cell membrane do?" });
    expect(q.sources).toEqual([expect.objectContaining({
      kind: "material_excerpt",
      materialId: "bio-notes",
      excerpt: "The cell membrane controls what enters and leaves the cell.",
      retrieved: true,
    })]);
    expect(ensureSpec).toHaveBeenCalledWith(courseId, conceptId);
    expect(getTodos().find((g) => g.courseId === courseId)?.open[0]?.href).toBe(`/course/${courseId}/practice/${conceptId}`);
  });

  it("runs diagnosis, targeted remediation and transfer to provisional on a generated spec", async () => {
    const { courseId, conceptId } = runtimeCourse();
    const first = await assess({ courseId, conceptId, answer: "The membrane stores DNA for the cell." });
    expect(first.evaluation).toMatchObject({
      verdict: "incorrect",
      misconceptionId: "membrane_stores_dna",
      misconceptionName: "Membrane stores DNA",
    });
    const initialEvidence = getEvidenceAttempt(first.attemptId);
    expect(initialEvidence.learningSpecRevision).toBe(1);
    expect(initialEvidence.sources).toEqual([expect.objectContaining({
      materialId: "bio-notes",
      excerpt: "The cell membrane controls what enters and leaves the cell.",
      retrieved: true,
    })]);
    expect(getCourse(courseId).concepts[0]!.state).toBe("needs_work");
    const remediation = getRemediation(first.attemptId);
    expect(remediation.lesson).toMatchObject({
      title: "Separate transport from DNA storage.",
      aiWording: true,
    });
    expect(remediation.lesson.sources).toEqual([expect.objectContaining({ materialId: "bio-notes", retrieved: true })]);
    expect(remediation.transfer.sources).toEqual([expect.objectContaining({ materialId: "bio-notes", retrieved: true })]);

    const transfer = await submitTransfer(first.attemptId, "transfer pass: it controls what enters and leaves.");
    if (transfer.result !== "pass") throw new Error("expected pass");
    expect(getEvidenceAttempt(transfer.resultAttemptId).learningSpecRevision).toBe(1);
    expect(getCourse(courseId).concepts[0]!.state).toBe("provisional");
    expect(getResult(transfer.resultAttemptId)).toMatchObject({ courseId, courseName: "Biology", conceptName: "Cell membrane" });
    expect(getMisconceptionLog(courseId)[0]).toMatchObject({ name: "Membrane stores DNA", open: false });
  });

  it("keeps transfer and review pinned to the exact spec revision that started the evidence episode", async () => {
    const { courseId, conceptId } = runtimeCourse();
    const first = await assess({ courseId, conceptId, answer: "It controls what enters and leaves." });
    expect(first.evaluation.verdict).toBe("correct");
    const firstTransfer = getTransferChallenge(first.attemptId);
    expect(firstTransfer.transfer.question).toContain("molecule");
    expect(firstTransfer.transfer.sources[0]?.excerpt).toBe("The cell membrane controls what enters and leaves the cell.");

    saveGeneratedLearningSpec(specFor(courseId, conceptId, 2), "fp-2");
    judgeTransferForSpec.mockImplementationOnce(async (used: ConceptLearningSpec) => {
      expect(used.revision).toBe(1);
      return { verdict: "pass", quote: null, misconceptionId: null, feedback: null, votes: { agree: 3, of: 3 } };
    });
    const transfer = await submitTransfer(first.attemptId, "transfer pass");
    if (transfer.result !== "pass") throw new Error("expected pass");
    const transferEvidence = getEvidenceAttempt(transfer.resultAttemptId);
    expect(transferEvidence.learningSpecRevision).toBe(1);
    expect(transferEvidence.sources[0]?.excerpt).toBe("The cell membrane controls what enters and leaves the cell.");

    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const reviewChallenge = getReviewChallenge(courseId, conceptId, due);
    expect(reviewChallenge.review.question).toContain("classmate");
    expect(reviewChallenge.review.sources[0]?.excerpt).toBe("The cell membrane controls what enters and leaves the cell.");
    judgeReviewForSpec.mockImplementationOnce(async (used: ConceptLearningSpec) => {
      expect(used.revision).toBe(1);
      return { verdict: "pass", quote: null, misconceptionId: null, feedback: null, votes: { agree: 3, of: 3 } };
    });
    const review = await submitReview(courseId, conceptId, "review pass", due);
    if (review.result !== "pass") throw new Error("expected review pass");
    const reviewEvidence = getEvidenceAttempt(review.resultAttemptId);
    expect(reviewEvidence.learningSpecRevision).toBe(1);
    expect(reviewEvidence.sources[0]?.excerpt).toBe("The cell membrane controls what enters and leaves the cell.");
    expect(getCourse(courseId).concepts[0]!.state).toBe("mastered");
    expect(getReviewResult(review.resultAttemptId)).toMatchObject({ courseId, courseName: "Biology", next: "mastered" });
  });

  it("demotes a runtime concept when delayed retrieval confirms its misconception again", async () => {
    const { courseId, conceptId } = runtimeCourse();
    const first = await assess({ courseId, conceptId, answer: "It controls what enters and leaves." });
    const transfer = await submitTransfer(first.attemptId, "transfer pass");
    if (transfer.result !== "pass") throw new Error("expected pass");
    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const review = await submitReview(courseId, conceptId, "It stores DNA.", due);
    expect(review.result).toBe("fail");
    expect(getCourse(courseId).concepts[0]!.state).toBe("needs_work");
    expect(getReviews(due).due.some((item) => item.id === conceptId)).toBe(false);
  });
});
