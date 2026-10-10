import { beforeEach, describe, expect, it } from "vitest";
import { getRewards, listCourses, setCoursesCompleted, setTaskDone } from "./store";
import { assess, clarify, getAttempt, getEvidenceAttempt, getCourse, getDashboard, getQuestion, getRemediation, getFiles, getHistory, getMisconceptionLog, getResult, getReviewBase, getReviews, getSidebar, getTransferChallenge, InvalidAttemptLinkError, NotFoundError, submitTransfer } from "./store";

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

describe("evidence lineage", () => {
  it("history resumes an uncertain assessment on the same evidence chain", async () => {
    const first = await run("Not sure yet");
    expect(getHistory()[0]).toMatchObject({
      title: "Answered CI interpretation",
      tone: "warn",
      href: `/course/intro-stats/practice/cii?clarify=${first.attemptId}`,
    });
  });

  it("records a clarification as a child of the response it clarifies", async () => {
    const first = await run("Not sure");
    const second = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG, followUpTo: first.attemptId });
    expect(getAttempt(first.attemptId)).toMatchObject({ kind: "initial", outcome: "uncertain", parentAttemptId: null, rootAttemptId: first.attemptId });
    expect(getAttempt(second.attemptId)).toMatchObject({ kind: "clarification", outcome: "incorrect", parentAttemptId: first.attemptId, rootAttemptId: first.attemptId });
  });

  it("preserves one root across a multi-turn clarification chain", async () => {
    const first = await run("Not sure");
    const second = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Still not sure", followUpTo: first.attemptId });
    const third = await assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG, followUpTo: second.attemptId });
    expect(getAttempt(second.attemptId)).toMatchObject({ parentAttemptId: first.attemptId, rootAttemptId: first.attemptId });
    expect(getAttempt(third.attemptId)).toMatchObject({ parentAttemptId: second.attemptId, rootAttemptId: first.attemptId });
    expect(getHistory().map((h) => h.title)).toEqual(["Clarified CI interpretation", "Clarified CI interpretation", "Answered CI interpretation"]);
  });

  it("rejects a follow-up linked to a different concept without mutating that concept", async () => {
    const first = await run("Not sure");
    await expect(assess({ courseId: "intro-stats", conceptId: "se", answer: "Researcher B has the smaller standard error because n is larger.", followUpTo: first.attemptId })).rejects.toThrow(InvalidAttemptLinkError);
    expect(state("se")).toBe("developing");
  });

  it("rejects a missing follow-up parent instead of silently starting a new chain", async () => {
    await expect(assess({ courseId: "intro-stats", conceptId: "cii", answer: WRONG, followUpTo: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("rejects a stale clarification parent after newer evaluated evidence exists in the episode", async () => {
    const first = await run("Not sure yet");
    const second = await assess({ courseId: "intro-stats", conceptId: "cii", answer: "Still not sure yet", followUpTo: first.attemptId });
    expect(second.evaluation.verdict).toBe("uncertain");
    await expect(assess({
      courseId: "intro-stats", conceptId: "cii",
      answer: "I meant the long-run method, not this one interval.",
      followUpTo: first.attemptId,
    })).rejects.toThrow(InvalidAttemptLinkError);
  });

  it("uses the diagnosed misconception to ask a discriminating dispute question", async () => {
    const first = await run(WRONG);
    const q = clarify(first.attemptId).followUp;
    expect(q).toContain("long-run method");
    expect(q).toContain("one already-calculated interval");
  });

  it("lets a clarification explicitly correct earlier wording without requiring the exact original phrase", async () => {
    const first = await run(WRONG);
    const second = await assess({
      courseId: "intro-stats", conceptId: "cii",
      answer: "I meant the long-run method, not this one interval.",
      followUpTo: first.attemptId,
    });
    expect(second.evaluation.verdict).toBe("correct");
    expect(getAttempt(second.attemptId)).toMatchObject({ kind: "clarification", parentAttemptId: first.attemptId, rootAttemptId: first.attemptId });
    expect(state("cii")).toBe("developing");
    expect(getTransferChallenge(second.attemptId).attemptId).toBe(second.attemptId);
  });
});

describe("correct-answer transfer path", () => {
  it("does not mistake an explicit rejection of the CI misconception for the misconception itself", async () => {
    const r = await run("It does not mean there is a 95% probability that the true mean is inside this interval; 95% describes the long-run method.");
    expect(r.evaluation).toMatchObject({ verdict: "correct", misconceptionId: null });
  });

  it("requires a different question before a correct first answer becomes provisional", async () => {
    const first = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    expect(first.evaluation.verdict).toBe("correct");
    expect(state("cii")).toBe("developing");
    const challenge = getTransferChallenge(first.attemptId);
    expect(challenge.transfer.question).toContain("100 researchers");
    const pass = await submitTransfer(first.attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected transfer pass");
    const result = getResult(pass.resultAttemptId);
    expect(result).toMatchObject({ previous: "developing", next: "provisional", diagnosisLabel: "Diagnosis", misconception: "None detected", intervention: "No remediation needed" });
    expect(state("cii")).toBe("provisional");
  });

  it("does not let an incorrect first answer skip remediation and jump to transfer", async () => {
    const first = await run(WRONG);
    expect(() => getTransferChallenge(first.attemptId)).toThrow(NotFoundError);
  });

  it("rejects an old correct attempt after newer conclusive evidence changes the concept", async () => {
    const first = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    expect(getTransferChallenge(first.attemptId).attemptId).toBe(first.attemptId);
    await run(WRONG);
    expect(() => getTransferChallenge(first.attemptId)).toThrow(NotFoundError);
    await expect(submitTransfer(first.attemptId, RIGHT_TRANSFER)).rejects.toThrow(InvalidAttemptLinkError);
    expect(state("cii")).toBe("needs_work");
  });

  it("treats a successful dispute clarification as an overturned diagnosis, not a repaired misconception", async () => {
    const first = await run(WRONG);
    const clarified = await assess({
      courseId: "intro-stats", conceptId: "cii",
      answer: "I meant the long-run method, not this one interval.",
      followUpTo: first.attemptId,
    });
    expect(clarified.evaluation.verdict).toBe("correct");
    expect(getMisconceptionLog("intro-stats")).toEqual([]);
    expect(getDashboard().recentlyCaught).toEqual([]);

    const pass = await submitTransfer(clarified.attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected transfer pass");
    expect(getResult(pass.resultAttemptId)).toMatchObject({
      diagnosisLabel: "Diagnosis",
      misconception: "Not confirmed after clarification",
      intervention: "Clarified the diagnosis",
    });
  });
});

describe("repair and transfer", () => {
  it("fails a transfer answer that mixes correct long-run language with the original CI misconception", async () => {
    const first = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    const fail = await submitTransfer(first.attemptId, "About 95 of 100 intervals contain it because of the long-run method, and each finished interval still has a 95% probability of containing the mean.");
    expect(fail.result).toBe("fail");
    if (fail.result !== "fail") throw new Error("expected fail");
    expect(fail.nextAttemptId).not.toBeNull();
  });

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
    expect(getAttempt(t.nextAttemptId)).toMatchObject({ kind: "transfer", outcome: "fail", parentAttemptId: attemptId, rootAttemptId: attemptId });
    expect(getAttempt(t.nextAttemptId).evaluation.verdict).toBe("incorrect");
    const pass = await submitTransfer(t.nextAttemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getEvidenceAttempt(pass.resultAttemptId)).toMatchObject({ kind: "transfer", outcome: "pass", parentAttemptId: t.nextAttemptId, rootAttemptId: attemptId, evaluation: null });
    expect(getResult(pass.resultAttemptId).transferText).toBe("Correct after 1 earlier miss");
  });

  it("persists a vague transfer miss, keeps state unchanged, and counts it when the student later passes", async () => {
    const { attemptId } = await run(WRONG);
    const t = await submitTransfer(attemptId, "I think around ninety five maybe");
    expect(t).toMatchObject({ result: "fail", nextAttemptId: null });
    if (t.result !== "fail") throw new Error("expected a failed transfer");
    expect(getEvidenceAttempt(t.failedAttemptId)).toMatchObject({ kind: "transfer", outcome: "fail", parentAttemptId: attemptId, rootAttemptId: attemptId, evaluation: { verdict: "uncertain", errorType: "uncertain" } });
    expect(state("cii")).toBe("needs_work");
    expect(getHistory()[0]).toMatchObject({
      title: "Tried the new question on CI interpretation",
      tone: "warn",
      href: `/course/intro-stats/transfer/${attemptId}`,
    });
    const pass = await submitTransfer(attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getResult(pass.resultAttemptId).transferText).toBe("Correct after 1 earlier miss");
  });

  it("rejects another transfer submission after the evidence chain has already passed", async () => {
    const { attemptId } = await run(WRONG);
    const pass = await submitTransfer(attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    const before = getHistory().length;
    await expect(submitTransfer(attemptId, RIGHT_TRANSFER)).rejects.toThrow(InvalidAttemptLinkError);
    expect(getHistory()).toHaveLength(before);
    expect(state("cii")).toBe("provisional");
  });

  it("only offers a result page for a passed transfer", async () => {
    const { attemptId } = await run(WRONG);
    expect(() => getResult(attemptId)).toThrow(NotFoundError);
    expect(() => getRemediation("missing")).toThrow(NotFoundError);
  });
});

describe("standard-error transfer semantics", () => {
  const start = () => assess({
    courseId: "intro-stats", conceptId: "se",
    answer: "Researcher B with 400 students has the smaller standard error because standard error decreases as sample size gets larger.",
  });
  it("does not mistake a rejected bigger-sample/bigger-error claim for the misconception", async () => {
    const r = await assess({
      courseId: "intro-stats", conceptId: "se",
      answer: "A bigger sample does not mean a bigger standard error; Researcher B has the smaller standard error because it decreases as n grows.",
    });
    expect(r.evaluation).toMatchObject({ verdict: "correct", misconceptionId: null });
  });


  it("passes only when the factor and square-root reasoning are both present", async () => {
    const first = await start();
    expect(first.evaluation.verdict).toBe("correct");
    const pass = await submitTransfer(first.attemptId, "The standard error is cut in half because n is four times larger and sqrt(4) = 2.");
    expect(pass.result).toBe("pass");
    expect(state("se")).toBe("provisional");
  });

  it("diagnoses the known direction misconception on a clearly wrong transfer", async () => {
    const first = await start();
    const fail = await submitTransfer(first.attemptId, "The standard error doubles because 400 is four times the sample size.");
    expect(fail.result).toBe("fail");
    if (fail.result !== "fail" || !fail.nextAttemptId) throw new Error("expected a diagnosed transfer failure");
    expect(getAttempt(fail.nextAttemptId).evaluation).toMatchObject({
      verdict: "incorrect", misconceptionId: "more_data_more_error", misconceptionName: "More data means more error",
    });
    expect(state("se")).toBe("needs_work");
  });

  it("treats an incomplete factor-only answer as insufficient evidence, not a misconception", async () => {
    const first = await start();
    const fail = await submitTransfer(first.attemptId, "It gets cut in half.");
    expect(fail).toMatchObject({ result: "fail", nextAttemptId: null, followUp: expect.any(String) });
    if (fail.result !== "fail") throw new Error("expected failed transfer");
    expect(getEvidenceAttempt(fail.failedAttemptId).evaluation).toMatchObject({ verdict: "uncertain", misconceptionId: null });
    expect(state("se")).toBe("developing");
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
  it("surfaces a misconception discovered on transfer in recently caught", async () => {
    const first = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    const fail = await submitTransfer(first.attemptId, "Each finished interval still has a 95% chance of containing the mean.");
    expect(fail.result).toBe("fail");
    expect(getDashboard().recentlyCaught[0]).toMatchObject({
      misconception: "Parameter probability trap",
      concept: "CI interpretation",
      repaired: false,
    });
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
  it("does not reuse an old transfer pass to mark a newly reopened misconception as repaired", async () => {
    const first = await run(WRONG);
    const repaired = await submitTransfer(first.attemptId, RIGHT_TRANSFER);
    if (repaired.result !== "pass") throw new Error("expected pass");

    await run(WRONG);
    expect(state("cii")).toBe("needs_work");
    expect(getMisconceptionLog("intro-stats")[0]).toMatchObject({ open: true });

    const correct = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    expect(correct.evaluation.verdict).toBe("correct");
    expect(state("cii")).toBe("developing");
    expect(getMisconceptionLog("intro-stats")[0]).toMatchObject({ open: true, note: "Open until you pass a new question" });

    const repass = await submitTransfer(correct.attemptId, RIGHT_TRANSFER);
    if (repass.result !== "pass") throw new Error("expected second pass");
    expect(getMisconceptionLog("intro-stats")[0]).toMatchObject({ open: false });
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

describe("sample completed course", () => {
  it("shows up as completed in the sidebar while Intro Statistics stays in progress", () => {
    const rows = getSidebar().courses;
    expect(rows.find((c) => c.id === "intro-stats")?.completed).toBe(false);
    expect(rows.find((c) => c.id === "linear-algebra")).toMatchObject({ completed: true, pct: 100, name: "Linear Algebra" });
  });

  it("opens as a read-only map, and cannot be practiced", async () => {
    const c = getCourse("linear-algebra");
    expect(c).toMatchObject({ proven: 8, total: 8, needsWork: 0, nextUp: null });
    expect(c.concepts.every((x) => x.cta.href === null)).toBe(true);
    await expect(assess({ courseId: "linear-algebra", conceptId: "la-vec", answer: "anything at all here" })).rejects.toThrow(NotFoundError);
  });

  it("does not leak Intro Statistics' risk into the sample's review", () => {
    const base = getReviewBase("linear-algebra");
    expect(base.riskConcept).toBeNull();
    expect(base.nextHref).toBeNull();
    expect(base.concepts).toHaveLength(8);
    expect(getMisconceptionLog("linear-algebra")).toEqual([]);
    expect(getFiles("linear-algebra").files[0]?.kind).toBe("Sample");
  });
});

describe("marking courses completed", () => {
  it("lets the student complete an unfinished course, and reopen it", () => {
    expect(listCourses().find((c) => c.id === "intro-stats")).toMatchObject({ completed: false, manual: false });
    setCoursesCompleted(["intro-stats"], true);
    expect(listCourses().find((c) => c.id === "intro-stats")).toMatchObject({ completed: true, manual: true, pct: 42 });
    expect(getSidebar().courses.find((c) => c.id === "intro-stats")?.completed).toBe(true);
    setCoursesCompleted(["intro-stats"], false);
    expect(getSidebar().courses.find((c) => c.id === "intro-stats")?.completed).toBe(false);
  });

  it("can reopen a course that finished on its own", () => {
    expect(listCourses().find((c) => c.id === "linear-algebra")?.completed).toBe(true);
    setCoursesCompleted(["linear-algebra"], false);
    expect(listCourses().find((c) => c.id === "linear-algebra")).toMatchObject({ completed: false, manual: true });
  });

  it("applies a batch all or nothing", () => {
    expect(() => setCoursesCompleted(["intro-stats", "nope"], true)).toThrow(NotFoundError);
    expect(listCourses().find((c) => c.id === "intro-stats")?.completed).toBe(false);
  });

  it("never completes an empty course by itself", () => {
    getSidebar();
    (globalThis as unknown as { __proveit: { course: { concepts: unknown[] } } }).__proveit.course.concepts = [];
    expect(getSidebar().courses.find((c) => c.id === "intro-stats")?.completed).toBe(false);
  });
});

describe("ticker rows", () => {
  it("counts each course's concepts by status and names what is next", () => {
    const rows = Object.fromEntries(listCourses().map((c) => [c.id, c]));
    expect(rows["intro-stats"]).toMatchObject({ proven: 5, inProgress: 3, needsWork: 1, notStarted: 3, next: "CI interpretation" });
    expect(rows["linear-algebra"]).toMatchObject({ proven: 8, inProgress: 0, notStarted: 0, next: null, completed: true });
    expect(rows["personal-finance"]).toMatchObject({ proven: 3, inProgress: 3, notStarted: 2, next: "Debt payoff", completed: false });
    for (const c of Object.values(rows)) expect(c.proven + c.inProgress + c.needsWork + c.notStarted).toBe(c.total);
  });
});

describe("rank points", () => {
  it("starts from the seeded evidence and explains every point", () => {
    const r = getRewards();
    expect(r.points).toBe(6000);
    expect(r.tier.name).toBe("Platinum");
    expect(r.breakdown.reduce((n, b) => n + b.points, 0)).toBe(6000);
    expect(r.breakdown.find((b) => b.label === "Concepts mastered")).toMatchObject({ count: 16, points: 4800 });
    expect(r.breakdown.find((b) => b.label === "Courses mastered end to end")).toMatchObject({ count: 1, points: 1000 });
    expect(getRewards()).toEqual(r);
  });

  it("adds exactly the proved, repaired, first-try and streak points when a transfer question is passed", async () => {
    const { attemptId } = await run(WRONG);
    const pass = await submitTransfer(attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getRewards().points).toBe(6000 + 200 + 100 + 50 + 25);
    expect(getResult(pass.resultAttemptId).points.reduce((n, p) => n + p.points, 0)).toBe(350);
  });

  it("does not award a repair bonus when a sound first answer proves transfer directly", async () => {
    const first = await run("Over repeated samples, about 95% of intervals made by the method contain the true mean.");
    const pass = await submitTransfer(first.attemptId, RIGHT_TRANSFER);
    if (pass.result !== "pass") throw new Error("expected pass");
    expect(getRewards().points).toBe(6000 + 200 + 50 + 25);
    const resultPoints = getResult(pass.resultAttemptId).points;
    expect(resultPoints).toEqual([
      { label: "Proved the concept", points: 200 },
      { label: "Passed on the first try", points: 50 },
    ]);
  });

    it("earns nothing for ticking a task or marking a course done by hand", () => {
    setTaskDone("pv", true);
    setCoursesCompleted(["intro-stats", "personal-finance"], true);
    expect(getRewards().points).toBe(6000);
  });

  it("does not pay a second time for the same concept, so a wrong answer can't be cycled for points", async () => {
    const first = await run(WRONG);
    await submitTransfer(first.attemptId, RIGHT_TRANSFER);
    const after = getRewards().points;
    const again = await run(WRONG);
    await submitTransfer(again.attemptId, RIGHT_TRANSFER);
    expect(getRewards().points).toBe(after);
  });

  it("never lets rank drop when a concept slips back", async () => {
    const { attemptId } = await run(WRONG);
    await submitTransfer(attemptId, RIGHT_TRANSFER);
    const high = getRewards().points;
    await run(WRONG);
    expect(getRewards().points).toBe(high);
  });

  it("pays the course bonus only when concepts earned it, not for a hand-marked course", () => {
    setCoursesCompleted(["linear-algebra"], false);
    setCoursesCompleted(["linear-algebra"], true);
    expect(getRewards().breakdown.find((b) => b.label === "Courses mastered end to end")?.count).toBe(0);
  });
});
