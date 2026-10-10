import { beforeEach, describe, expect, it } from "vitest";
import { assess, getAttempt, getCourse, getDashboard, getQuestion, getRemediation, getResult, NotFoundError, submitTransfer } from "./store";

const WRONG = "It means there's a 95% probability that the true population mean is inside our interval.";
const RIGHT_TRANSFER = "About 95 of them. But for any one interval that's already calculated, there's no 95% chance. It either contains the mean or it doesn't.";
const run = (answer: string) => assess({ courseId: "intro-stats", conceptId: "cii", answer });
const state = (id: string) => getCourse("intro-stats").concepts.find((c) => c.id === id)!.state;

beforeEach(() => {
  (globalThis as { __proveit?: unknown }).__proveit = undefined;
});

describe("diagnosis", () => {
  it("flags the parameter probability trap and quotes the exact phrase", () => {
    const { evaluation: e, attemptId } = run(WRONG);
    expect(e.verdict).toBe("incorrect");
    expect(e.misconceptionName).toBe("Parameter probability trap");
    expect(WRONG.includes(e.evidenceQuote!)).toBe(true);
    expect(e.votes).toBeNull();
    expect(getAttempt(attemptId).state).toBe("needs_work");
  });

  it("asks for one more answer instead of guessing on a short answer", () => {
    const { evaluation: e } = run("Not sure");
    expect(e.verdict).toBe("uncertain");
    expect(e.misconceptionName).toBeNull();
    expect(e.followUp).toBeTruthy();
  });

  it("does not move a concept to mastered on a correct first answer", () => {
    const { evaluation: e } = run("If you repeat the method many times, about 95% of the intervals catch the mean.");
    expect(e.verdict).toBe("correct");
    expect(state("cii")).toBe("developing");
  });

  it("rejects concepts with no authored content", () => {
    expect(() => assess({ courseId: "intro-stats", conceptId: "pv", answer: "anything at all here" })).toThrow(NotFoundError);
    expect(() => getQuestion("nope", "cii")).toThrow(NotFoundError);
  });
});

describe("repair and transfer", () => {
  it("runs the full loop: wrong, lesson, transfer pass, provisional", () => {
    const { attemptId } = run(WRONG);
    expect(getRemediation(attemptId).lesson.said).toContain("95% probability");
    const t = submitTransfer(attemptId, RIGHT_TRANSFER);
    expect(t.result).toBe("pass");
    if (t.result !== "pass") return;
    const r = getResult(t.resultAttemptId);
    expect([r.previous, r.next]).toEqual(["needs_work", "provisional"]);
    expect(r.transferText).toBe("Correct on first try");
    expect(r.nextConcept?.name).toBe("Standard error");
    expect(state("cii")).toBe("provisional");
    expect(getCourse("intro-stats").pct).toBe(46);
  });

  it("restating the misconception on transfer creates a fresh diagnosis and carries the miss count", () => {
    const { attemptId } = run(WRONG);
    const t = submitTransfer(attemptId, "Each interval has a 95% chance of containing the mean, even after it's built.");
    expect(t.result).toBe("fail");
    if (t.result !== "fail" || !t.nextAttemptId) throw new Error("expected a new diagnosis");
    expect(getAttempt(t.nextAttemptId).evaluation.verdict).toBe("incorrect");
    const pass = submitTransfer(t.nextAttemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getResult(pass.resultAttemptId).transferText).toBe("Correct after 1 earlier miss");
  });

  it("a vague transfer answer stays on the lesson with a follow-up and leaves state alone", () => {
    const { attemptId } = run(WRONG);
    const t = submitTransfer(attemptId, "I think around ninety five maybe");
    expect(t).toMatchObject({ result: "fail", nextAttemptId: null });
    expect(state("cii")).toBe("needs_work");
  });

  it("only offers a result page for a passed transfer", () => {
    const { attemptId } = run(WRONG);
    expect(() => getResult(attemptId)).toThrow(NotFoundError);
    expect(() => getRemediation("missing")).toThrow(NotFoundError);
  });
});

describe("dashboard", () => {
  it("is stable across repeated reads and reflects attempts", () => {
    expect(getDashboard()).toEqual(getDashboard());
    expect(getDashboard().recentlyCaught).toEqual([]);
    run(WRONG);
    const d = getDashboard();
    expect(d.recentlyCaught[0]).toMatchObject({ misconception: "Parameter probability trap", repaired: false });
    expect(d.courses[0]?.openMisconception).toBe("Parameter probability trap");
    expect(d.counts.due).toBe(0);
  });
});
