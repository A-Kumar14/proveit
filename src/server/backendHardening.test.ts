import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocked = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mocked.generateText(...args),
  Output: { object: (value: unknown) => value },
}));

vi.mock("./ai", () => ({
  aiEnabled: () => true,
  aiProvider: () => "google",
  aiModelId: () => "gemini-hardening-test",
  model: () => "mock-model",
}));

import { closePersistenceForTests } from "./persistence";
import { clearUserCachesForTests, runAsUser } from "./userScope";
import { clearLearningSpecGenerationForTests } from "./learningSpecGenerator";
import { saveMaterial } from "./materials";
import {
  assess,
  createCourse,
  ensureQuestion,
  getCourse,
  getEvidenceAttempt,
  getHistory,
  getRemediation,
  getReviewChallenge,
  submitReview,
  submitTransfer,
} from "./store";

type GenerationPrompt = { sources: { id: string; excerpt: string }[] };

const generatedDraft = (sourceId: string) => ({
  assessment: {
    question: "Why does a cell membrane matter for movement across the cell boundary?",
    correctAnswer: "The cell membrane controls what enters and leaves the cell.",
    rubric: "States that the membrane controls movement into and out of the cell.",
    probe: "Does the membrane control movement or let everything cross freely?",
    sourceIds: [sourceId],
  },
  misconceptions: [{
    name: "Everything crosses freely",
    description: "The learner treats the membrane as if it does not control movement across the boundary.",
    clarificationQuestion: "Do you mean every substance crosses freely, or that the membrane controls entry and exit?",
    sourceIds: [sourceId],
    remediation: {
      title: "The membrane controls exchange.",
      actuallyTrue: "The membrane controls what enters and leaves the cell.",
      explanation: "It is a regulating boundary, not an open gap.",
      sourceIds: [sourceId],
    },
  }],
  transfer: {
    question: "A molecule reaches a cell boundary. What membrane role matters in this new situation?",
    correctAnswer: "The membrane controls whether material enters or leaves.",
    rubric: "Applies the membrane's control of movement to the new boundary scenario.",
    hint: "Think about what the boundary regulates.",
    sourceIds: [sourceId],
  },
  review: {
    question: "A classmate says everything can cross the cell boundary freely. Correct that statement.",
    correctAnswer: "The membrane controls what enters and leaves the cell.",
    rubric: "Rejects unrestricted crossing and states the membrane's control of movement.",
    hint: "Recall the membrane's boundary role.",
    sourceIds: [sourceId],
  },
  skillLabel: "Conceptual understanding",
});

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "proveit-hardening-"));
  vi.stubEnv("PROVEIT_DB_PATH", join(dir, "state.sqlite"));
  mocked.generateText.mockReset();
  clearLearningSpecGenerationForTests();
  clearUserCachesForTests();
  closePersistenceForTests();

  mocked.generateText.mockImplementation(async (options: unknown) => {
    const input = options as { system?: string; prompt?: string };
    const system = input.system ?? "";
    const prompt = input.prompt ?? "";

    if (system.startsWith("You design one mastery-learning specification")) {
      const packet = JSON.parse(prompt) as GenerationPrompt;
      return { output: generatedDraft(packet.sources[0]!.id) };
    }

    if (system.startsWith("You grade a student's visible answer")) {
      const wrong = prompt.includes("everything crosses freely");
      return {
        output: wrong
          ? { verdict: "incorrect", misconceptionId: "everything_crosses_freely", evidenceQuote: "everything crosses freely" }
          : { verdict: "correct", misconceptionId: null, evidenceQuote: null },
      };
    }

    if (system.startsWith("You grade a student's visible retrieval or transfer answer")) {
      return { output: { verdict: "pass", misconceptionId: null, evidenceQuote: null, feedback: null } };
    }

    throw new Error("Unexpected model call in backend hardening test.");
  });
});

afterEach(() => {
  clearLearningSpecGenerationForTests();
  clearUserCachesForTests();
  closePersistenceForTests();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("generated-course backend regression", () => {
  it("persists a source-grounded diagnosis -> repair -> transfer -> delayed-review mastery loop per user", async () => {
    const owned = await runAsUser("A", async () => {
      const courseId = createCourse({
        name: "Private Biology",
        outline: {
          units: [{
            name: "Cells",
            concepts: [{
              name: "Cell membrane",
              short: "Membrane",
              desc: "Explain how the membrane controls movement across the cell boundary.",
            }],
          }],
          prerequisites: [],
        },
        files: [{ name: "cells.md", kind: "Notes, uploaded", detail: "Private cell notes" }],
      });
      const conceptId = getCourse(courseId).concepts[0]!.id;
      const notes = "## Cell membrane\nThe cell membrane controls what enters and leaves the cell. It forms a regulating cell boundary.";
      saveMaterial(courseId, { name: "cells.md", mime: "text/markdown", size: notes.length }, notes, "text");

      const question = await ensureQuestion(courseId, conceptId);
      expect(question.sources).toEqual([expect.objectContaining({
        kind: "material_excerpt",
        materialId: expect.any(String),
        excerpt: expect.stringContaining("cell membrane controls what enters and leaves"),
        retrieved: true,
      })]);

      const first = await assess({
        courseId,
        conceptId,
        answer: "I think everything crosses freely through the membrane.",
      });
      expect(first.evaluation).toMatchObject({
        verdict: "incorrect",
        misconceptionId: "everything_crosses_freely",
        misconceptionName: "Everything crosses freely",
      });
      expect(getCourse(courseId).concepts[0]!.state).toBe("needs_work");

      const lesson = getRemediation(first.attemptId);
      expect(lesson.lesson.title).toBe("The membrane controls exchange.");
      expect(lesson.lesson.sources[0]).toMatchObject({ retrieved: true, materialId: expect.any(String) });

      const transfer = await submitTransfer(
        first.attemptId,
        "The membrane controls whether material enters or leaves at the cell boundary.",
      );
      if (transfer.result !== "pass") throw new Error("expected transfer pass");
      expect(getCourse(courseId).concepts[0]!.state).toBe("provisional");
      const transferEvidence = getEvidenceAttempt(transfer.resultAttemptId);
      expect(transferEvidence.learningSpecRevision).toBe(1);
      expect(transferEvidence.sources[0]).toMatchObject({ retrieved: true, excerpt: expect.stringContaining("cell membrane") });

      const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const challenge = getReviewChallenge(courseId, conceptId, due);
      expect(challenge.learningSpecRevision).toBe(1);
      expect(challenge.review.sources[0]).toMatchObject({ retrieved: true, materialId: expect.any(String) });

      const review = await submitReview(
        courseId,
        conceptId,
        "The membrane regulates what enters and leaves; crossing is not unrestricted.",
        due,
        challenge.learningSpecRevision,
      );
      if (review.result !== "pass") throw new Error("expected review pass");
      expect(getCourse(courseId).concepts[0]!.state).toBe("mastered");
      expect(getEvidenceAttempt(review.resultAttemptId).sources[0]).toMatchObject({ retrieved: true });
      expect(getHistory().map((event) => event.title)).toEqual([
        "Passed delayed review on Cell membrane",
        "Passed the new question on Cell membrane",
        "Answered Cell membrane",
      ]);

      return { courseId, conceptId, reviewAttemptId: review.resultAttemptId };
    });

    // Clear every in-memory user cache and SQLite handle to prove the whole learner/spec/material chain reloads.
    clearLearningSpecGenerationForTests();
    clearUserCachesForTests();
    closePersistenceForTests();

    runAsUser("A", () => {
      expect(getCourse(owned.courseId).concepts[0]!.state).toBe("mastered");
      const evidence = getEvidenceAttempt(owned.reviewAttemptId);
      expect(evidence.learningSpecRevision).toBe(1);
      expect(evidence.sources[0]).toMatchObject({
        kind: "material_excerpt",
        retrieved: true,
        excerpt: expect.stringContaining("cell membrane controls what enters and leaves"),
      });
    });

    runAsUser("B", () => {
      expect(() => getCourse(owned.courseId)).toThrow();
      expect(() => getEvidenceAttempt(owned.reviewAttemptId)).toThrow();
    });
  });
});
