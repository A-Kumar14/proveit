import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
let ai = false;
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateText(...a), Output: { object: (o: unknown) => o } }));
vi.mock("./ai", () => ({ aiEnabled: () => ai, model: () => "mock-model" }));

import { startQuiz, submitQuiz } from "./quiz";
import { addCatalogCourse } from "./courses";
import { getCourse, getCourseRanks, getEvidenceAttempt, getHistory, getRewards, NotFoundError, stateAfterQuiz } from "./store";
import { removeCatalogCourse } from "./courses";
import { getQuizAudit } from "./quiz";

beforeEach(() => {
  ai = false;
  generateText.mockReset();
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
  (globalThis as { __proveitQuizzes?: unknown }).__proveitQuizzes = undefined;
  (globalThis as { __proveitMaterials?: unknown }).__proveitMaterials = undefined;
});

type MQ = { concept: string; prompt: string; options: string[]; answerIndex: number; explanation: string };
/** A model that answers each call for exactly the concepts and counts it was asked for. `change` can alter or drop a question. */
const quizModel = (change: (q: MQ, k: number) => MQ | null = (q) => q) =>
  generateText.mockImplementation(async ({ prompt }: { prompt: string }) => {
    const out: MQ[] = [];
    for (const c of JSON.parse(prompt).concepts as { name: string; questions: number }[]) {
      for (let k = 0; k < c.questions; k++) {
        const q = change({ concept: c.name, prompt: `${c.name} Q${k}?`, options: [`right ${c.name} ${k}`, `a ${c.name} ${k}`, `b ${c.name} ${k}`, `c ${c.name} ${k}`], answerIndex: 0, explanation: `Because ${c.name} ${k}.` }, k);
        if (q) out.push(q);
      }
    }
    return { output: { questions: out } };
  });
const answerWith = (q: { options: string[] }, right: boolean) => q.options.findIndex((o) => o.startsWith(right ? "right " : "a "));


describe("startQuiz offline", () => {
  it("builds questions for any course and keeps the answers on the server", async () => {
    addCatalogCourse("network-management");
    const q = await startQuiz("network-management", 5);
    expect(q.questions).toHaveLength(5);
    expect(q.aiWritten).toBe(false);
    for (const x of q.questions) {
      expect(x.options).toHaveLength(4);
      expect(new Set(x.options).size).toBe(4);
      expect(JSON.stringify(x)).not.toMatch(/correct|answerIndex/);
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


  it("rejects an unknown quiz", () => {
    expect(() => submitQuiz("nope", [])).toThrow(NotFoundError);
  });
});

describe("startQuiz with a model", () => {
  it("shuffles the options but keeps the right answer marked", async () => {
    ai = true;
    quizModel();
    const q = await startQuiz("intro-stats", 4);
    expect(q.aiWritten).toBe(true);
    const r = submitQuiz(q.quizId, q.questions.map((x) => answerWith(x, true)));
    expect(r.score).toBe(4);
    expect(r.items[0]!.explanation).toMatch(/^Because /);
  });

  it("drops questions with duplicate options and refuses a quiz that is mostly unusable", async () => {
    ai = true;
    quizModel((q, k) => (k === 0 && q.concept === "CI interpretation" ? { ...q, options: ["x", "x", "y", "z"] } : q));
    expect((await startQuiz("intro-stats", 4)).questions).toHaveLength(3);
    quizModel((q) => ({ ...q, options: ["x", "x", "y", "z"] }));
    await expect(startQuiz("intro-stats", 4)).rejects.toThrow(/too few/);
  });

  it("writes a long quiz as parallel calls that share no concept", async () => {
    ai = true;
    quizModel();
    const q = await startQuiz("intro-stats", 8);
    expect(generateText).toHaveBeenCalledTimes(4);
    const parts = generateText.mock.calls.map((c) => (JSON.parse(c[0].prompt).concepts as { name: string }[]).map((x) => x.name));
    const all = parts.flat();
    expect(new Set(all).size).toBe(all.length);
    expect(q.questions).toHaveLength(8);
  });

  it("writes a medium quiz as two parallel calls", async () => {
    ai = true;
    quizModel();
    await startQuiz("intro-stats", 6);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("puts uploaded notes in front of the model", async () => {
    ai = true;
    addCatalogCourse("chinese-101");
    quizModel();
    await startQuiz("chinese-101", 4);
    expect(generateText.mock.calls[0]![0].prompt).toContain("Mandarin");
  });
});

describe("what a quiz does to the map, the history and the rank", () => {
  const NM = "network-management";
  const stateOf = (id: string) => getCourse(NM).concepts.find((c) => c.id === id)!.state;
  /** Takes a full quiz, one question per concept, getting right exactly the concepts named. */
  async function take(rightNames: string[]) {
    ai = true;
    quizModel();
    const n = getCourse(NM).concepts.length;
    const q = await startQuiz(NM, n);
    return submitQuiz(q.quizId, q.questions.map((x) => answerWith(x, rightNames.includes(x.concept))));
  }
  const names = () => getCourse(NM).concepts.map((c) => c.name);

  it("follows one rule for what a quiz may do to a concept", () => {
    expect(stateAfterQuiz("not_started", 1, 2)).toBe("developing");
    expect(stateAfterQuiz("not_started", 0, 1)).toBe("developing");
    expect(stateAfterQuiz("developing", 0, 1)).toBe("developing");
    expect(stateAfterQuiz("developing", 0, 2)).toBe("developing");
    expect(stateAfterQuiz("developing", 2, 2)).toBe("developing");
    for (const s of ["needs_work", "provisional", "mastered"] as const) {
      expect(stateAfterQuiz(s, 2, 2)).toBe(s);
      expect(stateAfterQuiz(s, 0, 2)).toBe(s);
    }
    expect(stateAfterQuiz("not_started", 0, 0)).toBe("not_started");
  });

  it("moves the course map from the answers, and says what moved", async () => {
    addCatalogCourse(NM);
    const c = getCourse(NM).concepts;
    const r = await take([c[0]!.name, c[2]!.name]);
    expect(stateOf(c[0]!.id)).toBe("developing");
    expect(stateOf(c[1]!.id)).toBe("developing");
    expect(stateOf(c[2]!.id)).toBe("developing");
    expect(c.slice(3).every((x) => stateOf(x.id) === "developing")).toBe(true);
    expect(r.changes.filter((x) => x.to === "developing").map((x) => [x.concept, x.from]).sort()).toEqual(c.map((x) => [x.name, "not_started"]).sort());
    expect(r.changes).toHaveLength(c.length);
    expect(r.byConcept.find((x) => x.conceptId === c[2]!.id)).toMatchObject({ right: 1, total: 1 });
  });

  it("treats a question left blank as no evidence, so it can't flag a concept", async () => {
    addCatalogCourse(NM);
    ai = true;
    quizModel();
    const c = getCourse(NM).concepts;
    const q = await startQuiz(NM, c.length);
    const r = submitQuiz(q.quizId, q.questions.map((x) => (x.concept === c[0]!.name ? answerWith(x, true) : null)));
    expect(r.score).toBe(1);
    expect(r.changes.map((x) => x.concept)).toEqual([c[0]!.name]);
    expect(c.slice(1).every((x) => stateOf(x.id) === "not_started")).toBe(true);
  });

  it("never moves a concept that was proved by a new-question test, or one with an open misconception", async () => {
    ai = true;
    quizModel();
    const before = Object.fromEntries(getCourse("intro-stats").concepts.map((c) => [c.id, c.state]));
    const q = await startQuiz("intro-stats", 15);
    submitQuiz(q.quizId, q.questions.map((x) => answerWith(x, false)));
    for (const c of getCourse("intro-stats").concepts) if (["mastered", "provisional", "needs_work"].includes(before[c.id]!)) expect(c.state).toBe(before[c.id]);
  });

  it("keeps quiz evidence weak for mastery while awarding only mastered assessment allocations", async () => {
    addCatalogCourse(NM);
    const n = names();
    const start = getRewards().points;
    expect((await take([n[0]!, n[1]!])).pointsGained).toBe(0);
    expect((await take([n[0]!, n[2]!])).pointsGained).toBe(0);
    expect(getCourseRanks().find((r) => r.courseId === NM)!.points).toBe(0);
    expect(getCourse(NM).concepts.every((c) => c.state === "developing")).toBe(true);

    const mastered = await take(n);
    expect(mastered.pointsGained).toBeGreaterThan(0);
    const after = getRewards().points;
    expect(after).toBeGreaterThan(start);
    expect(getCourseRanks().find((r) => r.courseId === NM)!.points).toBeGreaterThan(0);
    expect(getCourse(NM).concepts.every((c) => c.state === "developing")).toBe(true);

    expect((await take(n)).pointsGained).toBe(0);
    expect(getRewards().points).toBe(after);
    expect(getHistory().filter((e) => e.quizPct === undefined).length).toBeGreaterThan(0);
  });

  it("saves the quiz to History and reopens it as an audit", async () => {
    addCatalogCourse(NM);
    const n = names();
    const r = await take([n[0]!]);
    const ev = getHistory().find((e) => e.id === r.quizId)!;
    expect(ev).toMatchObject({ title: `Quiz on Network Management: 1 of ${n.length}`, tone: "bad", href: `/course/${NM}/quiz/${r.quizId}` });
    expect(ev.quizPct).toBe(12.5);
    // Every other event is an attempt with an evidence record, which the History page looks up. A quiz must not be one of them.
    expect(getHistory().filter((e) => e.quizPct === undefined).every((e) => { try { return Boolean(getEvidenceAttempt(e.id)); } catch { return false; } })).toBe(true);
    expect(() => getEvidenceAttempt(r.quizId)).toThrow();
    expect(ev.detail).toContain(n[0]!);
    const audit = getQuizAudit(r.quizId);
    expect(audit).toMatchObject({ score: 1, total: n.length, courseId: NM, pointsGained: 0 });
    expect(audit.items[1]).toMatchObject({ picked: expect.any(Number), correct: expect.any(Number), explanation: expect.stringMatching(/^Because /) });
    expect(audit.changes).toHaveLength(n.length);
    expect(() => getQuizAudit("q999")).toThrow(NotFoundError);
  });

  it("rejects old quizzes and removes their history when a course is removed and re-added", async () => {
    addCatalogCourse(NM);
    ai = true;
    quizModel();
    const open = await startQuiz(NM, 4);
    const completed = submitQuiz(open.quizId, [0, 0, 0, 0]);
    const pending = await startQuiz(NM, 4);
    removeCatalogCourse(NM);
    addCatalogCourse(NM);
    expect(() => submitQuiz(pending.quizId, [0, 0, 0, 0])).toThrow(NotFoundError);
    expect(() => submitQuiz(open.quizId, [0, 0, 0, 0])).toThrow(NotFoundError);
    expect(() => getQuizAudit(completed.quizId)).toThrow(NotFoundError);
    expect(getHistory().some((e) => e.id === completed.quizId)).toBe(false);
    expect(getCourse(NM).concepts.every((c) => c.state === "not_started")).toBe(true);
  });

  it("quizzes one concept when asked, and in a full quiz drops questions about concepts that don't exist", async () => {
    addCatalogCourse(NM);
    const c = getCourse(NM).concepts;
    ai = true;
    quizModel();
    const q = await startQuiz(NM, undefined, c[1]!.id);
    expect(q.questions.map((x) => x.concept)).toEqual([c[1]!.name, c[1]!.name, c[1]!.name, c[1]!.name]);
    await expect(startQuiz(NM, undefined, "nope")).rejects.toBeInstanceOf(NotFoundError);
    quizModel((x, k) => (x.concept === c[0]!.name && k === 0 ? { ...x, concept: "Made up concept" } : x));
    expect((await startQuiz(NM, c.length)).questions).toHaveLength(c.length - 1);
  });
});

