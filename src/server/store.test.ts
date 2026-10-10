import { beforeEach, describe, expect, it } from "vitest";
import { assess, getAttempt, getCourse, getDashboard, getQuestion, getRemediation, getFiles, getHistory, getMisconceptionLog, getResult, getReviewBase, getReviews, getSidebar, NotFoundError, submitTransfer } from "./store";

const WRONG = "It means there's a 95% probability that the true population mean is inside our interval.";
const RIGHT_TRANSFER = "About 95 of them. But for any one interval that's already calculated, there's no 95% chance. It either contains the mean or it doesn't.";
const run = (answer: string) => assess({ courseId: "intro-stats", conceptId: "cii", answer });
const state = (id: string) => getCourse("intro-stats").concepts.find((c) => c.id === id)!.state;

beforeEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY; // tests cover the heuristic judges
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("diagnosis", () => {
  it("flags the parameter probability trap and quotes the exact phrase", async () => {
    const { evaluation: e, attemptId } = await run(WRONG);
    expect(e.verdict).toBe("incorrect");
    expect(e.misconceptionName).toBe("Parameter probability trap");
    expect(WRONG.includes(e.evidenceQuote!)).toBe(true);
    expect(e.votes).toBeNull();
    expect(getAttempt(attemptId).state).toBe("needs_work");
  });

  it("asks for one more answer instead of guessing on a short answer", async () => {
    const { evaluation: e } = await run("Not sure");
    expect(e.verdict).toBe("uncertain");
    expect(e.misconceptionName).toBeNull();
    expect(e.followUp).toBeTruthy();
  });

  it("does not move a concept to mastered on a correct first answer", async () => {
    const { evaluation: e } = await run("If you repeat the method many times, about 95% of the intervals catch the mean.");
    expect(e.verdict).toBe("correct");
    expect(state("cii")).toBe("developing");
  });

  it("rejects concepts with no authored content", async () => {
    await expect(assess({ courseId: "intro-stats", conceptId: "pv", answer: "anything at all here" })).rejects.toThrow(NotFoundError);
    expect(() => getQuestion("nope", "cii")).toThrow(NotFoundError);
  });
});

describe("repair and transfer", () => {
  it("runs the full loop: wrong, lesson, transfer pass, provisional", async () => {
    const { attemptId } = await run(WRONG);
    expect(getRemediation(attemptId).lesson.said).toContain("95% probability");
    const t = await submitTransfer(attemptId, RIGHT_TRANSFER);
    expect(t.result).toBe("pass");
    if (t.result !== "pass") return;
    const r = getResult(t.resultAttemptId);
    expect([r.previous, r.next]).toEqual(["needs_work", "provisional"]);
    expect(r.transferText).toBe("Correct on first try");
    expect(r.nextConcept?.name).toBe("Standard error");
    expect(state("cii")).toBe("provisional");
    expect(getCourse("intro-stats").pct).toBe(46);
  });

  it("restating the misconception on transfer creates a fresh diagnosis and carries the miss count", async () => {
    const { attemptId } = await run(WRONG);
    const t = await submitTransfer(attemptId, "Each interval has a 95% chance of containing the mean, even after it's built.");
    expect(t.result).toBe("fail");
    if (t.result !== "fail" || !t.nextAttemptId) throw new Error("expected a new diagnosis");
    expect(getAttempt(t.nextAttemptId).evaluation.verdict).toBe("incorrect");
    const pass = await submitTransfer(t.nextAttemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getResult(pass.resultAttemptId).transferText).toBe("Correct after 1 earlier miss");
  });

  it("a vague transfer answer stays on the lesson with a follow-up and leaves state alone", async () => {
    const { attemptId } = await run(WRONG);
    const t = await submitTransfer(attemptId, "I think around ninety five maybe");
    expect(t).toMatchObject({ result: "fail", nextAttemptId: null });
    expect(state("cii")).toBe("needs_work");
  });

  it("only offers a result page for a passed transfer", async () => {
    const { attemptId } = await run(WRONG);
    expect(() => getResult(attemptId)).toThrow(NotFoundError);
    expect(() => getRemediation("missing")).toThrow(NotFoundError);
  });
});

describe("dashboard", () => {
  it("is stable across repeated reads and reflects attempts", async () => {
    expect(getDashboard()).toEqual(getDashboard());
    expect(getDashboard().recentlyCaught).toEqual([]);
    await run(WRONG);
    const d = getDashboard();
    expect(d.recentlyCaught[0]).toMatchObject({ misconception: "Parameter probability trap", repaired: false });
    expect(d.courses[0]?.openMisconception).toBe("Parameter probability trap");
    expect(d.counts.due).toBe(0);
  });
});

describe("mastery review base", () => {
  it("computes numbers in code, hides not-started concepts, and is identical across runs", () => {
    const a = getReviewBase("intro-stats");
    expect(a).toEqual(getReviewBase("intro-stats"));
    expect(a.concepts).toHaveLength(9);
    expect(a.concepts.find((c) => c.name === "CI interpretation")).toMatchObject({ status: "reteaching", mastery: 59 });
    expect(a.concepts.some((c) => c.name === "p-value")).toBe(false);
    expect(a.fallback.misconceptions.find((m) => m.concept === "CI interpretation")?.misconception).toBe("Parameter probability trap");
  });

  it("rejects an unknown course", () => {
    expect(() => getReviewBase("nope")).toThrow(NotFoundError);
  });
});

describe("review queue, history and misconception log", () => {
  it("starts with an open seeded misconception, no history and no reviews", async () => {
    expect(getHistory()).toEqual([]);
    expect(getReviews()).toEqual({ due: [], upcoming: [] });
    expect(getSidebar().reviewsDue).toBe(0);
    expect(getMisconceptionLog("intro-stats")).toMatchObject([{ name: "Parameter probability trap", open: true, note: "From your earlier attempts" }]);
  });

  it("logs the answer, then the pass, and flips the misconception to repaired", async () => {
    const { attemptId } = await run(WRONG);
    expect(getHistory()[0]).toMatchObject({ detail: "Caught: Parameter probability trap", tone: "bad" });
    expect(getMisconceptionLog("intro-stats")[0]).toMatchObject({ open: true, href: `/course/intro-stats/lesson/${attemptId}` });
    await submitTransfer(attemptId, RIGHT_TRANSFER);
    expect(getHistory().map((h) => h.tone)).toEqual(["good", "bad"]);
    expect(getMisconceptionLog("intro-stats")[0]).toMatchObject({ open: false, note: "Fixed with a lesson and a new question" });
    expect(getReviews().upcoming).toMatchObject([{ id: "cii", due: false }]);
  });

  it("keeps the uploaded file name on the attempt only when an image was read", async () => {
    const withImg = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG, imageSummary: "handwritten work", imageName: "work.jpg" });
    expect(getAttempt(withImg.attemptId).attachment).toBe("work.jpg");
    const plain = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG, imageName: "ignored.jpg" });
    expect(getAttempt(plain.attemptId).attachment).toBeNull();
  });

  it("lists course files and rejects unknown courses", () => {
    expect(getFiles("intro-stats").files).toHaveLength(1);
    expect(() => getFiles("nope")).toThrow(NotFoundError);
    expect(() => getMisconceptionLog("nope")).toThrow(NotFoundError);
  });
});

describe("course completion", () => {
  it("is completed only when every concept is mastered", () => {
    expect(getSidebar().courses[0]?.completed).toBe(false);
    const db = (globalThis as unknown as { __proveit: { course: { concepts: { state: string }[] } } }).__proveit;
    db.course.concepts.forEach((c) => (c.state = "provisional"));
    expect(getSidebar().courses[0]?.completed).toBe(false);
    db.course.concepts.forEach((c) => (c.state = "mastered"));
    expect(getSidebar().courses[0]).toMatchObject({ completed: true, pct: 100 });
  });
});
