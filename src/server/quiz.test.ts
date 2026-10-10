import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { startQuiz, submitQuiz } from "./quiz";
import { addCatalogCourse } from "./courses";
import { assess, getCourse, getHistory, getMisconceptionLog, getQuizSignal, getRewards, NotFoundError, recordQuizEvidence, submitTransfer } from "./store";

beforeEach(() => {
  ai = false;
  generateText.mockReset();
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitQuizzes?: unknown }).__proveitQuizzes = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

const model = (n: number) => ({ questions: Array.from({ length: n }, (_, i) => ({ concept: "CI interpretation", prompt: `Q${i}?`, options: [`right${i}`, `a${i}`, `b${i}`, `c${i}`], answerIndex: 0, explanation: `Because ${i}.` })) });

describe("startQuiz offline", () => {
  it("builds questions for any course and keeps the answers on the server", async () => {
    addCatalogCourse("network-management");
    const q = await startQuiz("network-management", 5);
    expect(q.questions).toHaveLength(5);
    expect(q.aiWritten).toBe(false);
    for (const x of q.questions) {
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options).size).toBe(4);
      expect(JSON.stringify(x)).not.toMatch(/correct|answerIndex|conceptId/);
    }
  });

  it("works for the demo course too", async () => {
    const q = await startQuiz("intro-stats");
    expect(q.questions.length).toBeGreaterThan(0);
    expect(q.questions.length).toBeLessThanOrEqual(8);
  });

  it("starts with the concepts you are weak in", async () => {
    const q = await startQuiz("intro-stats", 3);
    expect(q.questions.map((x) => x.concept)).toContain("CI interpretation");
  });

  it("rejects an unknown course", async () => {
    await expect(startQuiz("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("submitQuiz", () => {
  it("grades by the server's answers, with a concept breakdown and a review", async () => {
    addCatalogCourse("accounting-101");
    const q = await startQuiz("accounting-101", 4);
    // Find the right option the way a student would: the offline right answer is the concept's own description.
    const course = getCourse("accounting-101");
    const right = (i: number) => q.questions[i]!.options.findIndex((o) => course.concepts.some((c) => c.desc === o && q.questions[i]!.prompt.includes(`"${c.name}"`)));
    const answers = [right(0), right(1), null, (right(3) + 1) % 4];
    const r = submitQuiz(q.quizId, answers);
    expect(r).toMatchObject({ score: 2, total: 4, pct: 50 });
    expect(r.items[2]).toMatchObject({ picked: null });
    expect(r.items[0]!.explanation).toBeTruthy();
    expect(r.byConcept.reduce((n, c) => n + c.right, 0)).toBe(2);
  });

  it("returns the first result when submitted twice", async () => {
    const q = await startQuiz("intro-stats", 3);
    const first = submitQuiz(q.quizId, [0, 0, 0]);
    expect(submitQuiz(q.quizId, [1, 1, 1])).toEqual(first);
  });

  it("records answered items as low-stakes evidence without granting proof, rank or a misconception", async () => {
    addCatalogCourse("accounting-101");
    const course = getCourse("accounting-101");
    const beforeRank = getRewards("accounting-101").points;
    const q = await startQuiz("accounting-101", 4);
    const first = q.questions[0]!;
    const concept = course.concepts.find((c) => c.name === first.concept)!;
    const correct = first.options.findIndex((o) => o === concept.desc);
    const wrong = (correct + 1) % 4;

    const result = submitQuiz(q.quizId, [wrong, null, null, null]);
    expect(result.total).toBe(4);
    expect(getCourse("accounting-101").concepts.find((c) => c.id === concept.id)?.state).toBe("developing");
    expect(getQuizSignal("accounting-101", concept.id)).toMatchObject({ right: 0, total: 1, pct: 0 });
    expect(getRewards("accounting-101").points).toBe(beforeRank);
    expect(getCourse("accounting-101").concepts.every((c) => c.state !== "provisional" && c.state !== "mastered")).toBe(true);
    expect(getMisconceptionLog("accounting-101")).toEqual([]);
    expect(getHistory()[0]).toMatchObject({ title: `Quiz check on ${concept.name}`, tone: "warn" });

    const historyCount = getHistory().length;
    submitQuiz(q.quizId, q.questions.map(() => correct));
    expect(getHistory()).toHaveLength(historyCount);
    expect(getQuizSignal("accounting-101", concept.id)?.total).toBe(1);
  });

  it("does not let a quiz signal stale an in-flight transfer proof", async () => {
    const first = await assess({
      courseId: "intro-stats",
      conceptId: "cii",
      answer: "Across repeated samples, about 95% of intervals built by this method contain the true mean.",
    });
    recordQuizEvidence("intro-stats", [{
      conceptId: "cii",
      prompt: "A low-stakes check",
      selected: "A distractor",
      correct: false,
    }]);
    const transfer = await submitTransfer(
      first.attemptId,
      "About 95 of 100 intervals contain the true mean. One realized interval either contains it or does not; 95% describes the method.",
    );
    expect(transfer.result).toBe("pass");
  });

  it("rejects an unknown quiz", () => {
    expect(() => submitQuiz("nope", [])).toThrow(NotFoundError);
  });
});

describe("startQuiz with a model", () => {
  it("shuffles the options but keeps the right answer marked", async () => {
    ai = true;
    generateText.mockResolvedValueOnce({ output: model(4) });
    const q = await startQuiz("intro-stats", 4);
    expect(q.aiWritten).toBe(true);
    const r = submitQuiz(q.quizId, q.questions.map((x, i) => x.options.indexOf(`right${i}`)));
    expect(r.score).toBe(4);
    expect(r.items[0]!.explanation).toBe("Because 0.");
  });

  it("drops questions with duplicate options and refuses a quiz that is mostly unusable", async () => {
    ai = true;
    const bad = model(4);
    bad.questions[0]!.options = ["x", "x", "y", "z"];
    generateText.mockResolvedValueOnce({ output: bad });
    expect((await startQuiz("intro-stats", 4)).questions).toHaveLength(3);
    const mostlyBad = model(4);
    mostlyBad.questions.forEach((x, i) => { if (i < 3) x.options = ["x", "x", "y", "z"]; });
    generateText.mockResolvedValueOnce({ output: mostlyBad });
    await expect(startQuiz("intro-stats", 4)).rejects.toThrow(/too few/);
  });

  it("puts uploaded notes in front of the model", async () => {
    ai = true;
    addCatalogCourse("chinese-101");
    generateText.mockResolvedValueOnce({ output: model(4) });
    await startQuiz("chinese-101", 4);
    expect(generateText.mock.calls[0]![0].prompt).toContain("Mandarin");
  });
});
