import "server-only";
import { cardStatus, type AssessInput, type AssessResult, type Evaluation, type MasteryState, type ReviewText, type TransferResult } from "@proveit/lib/schemas";
import { toneForPct, type Tone } from "@proveit/lib/mastery";
import { AUTHORED } from "./content";
import { judgeAnswer, judgeTransfer } from "./evaluator";

/**
 * In-memory stand-in for the real data layer. Every exported function is the seam the backend
 * replaces (Supabase or otherwise); pages and route handlers only talk to these.
 * State resets when the dev server restarts, which doubles as a demo reset.
 */

type Skill = { label: string; pct: number };
type Concept = {
  id: string; name: string; short: string; unit: string; desc: string; x: number; y: number;
  state: MasteryState;
  skills: Skill[] | null;
  evidence: { answers: number; sound: number; transferPassed: boolean };
  nextReview: string | null;
};
type Attempt = {
  id: string; courseId: string; conceptId: string; kind: "initial" | "transfer";
  answer: string; evaluation: Evaluation | null; passed: boolean;
  previousState: MasteryState; failedTransfers: number; createdAt: number;
};
type Db = { course: { id: string; name: string; deadline: string; concepts: Concept[]; edges: [string, string][] }; attempts: Attempt[]; provenDays: Set<string>; seq: number };

const app = (answers: number, sound: number, transferPassed = false) => ({ answers, sound, transferPassed });
const M: Skill[] = [{ label: "Application", pct: 90 }, { label: "New-question test", pct: 85 }];
const D: Skill[] = [{ label: "Application", pct: 64 }, { label: "New-question test", pct: 25 }];

function seed(): Db {
  const c = (id: string, name: string, short: string, unit: string, desc: string, x: number, y: number, state: MasteryState, skills: Skill[] | null, evidence: Concept["evidence"]): Concept =>
    ({ id, name, short, unit, desc, x, y, state, skills, evidence, nextReview: null });
  const U1 = "01 SAMPLING", U2 = "02 DISTRIBUTIONS", U3 = "03 CONFIDENCE INTERVALS", U4 = "04 HYPOTHESIS TESTING";
  return {
    course: {
      id: "intro-stats", name: "Intro Statistics", deadline: "Quiz Thursday, Oct 15",
      concepts: [
        c("pop", "Population vs. sample", "Population", U1, "Tell the whole group apart from the part you measured.", 60, 72, "mastered", M, app(3, 3, true)),
        c("par", "Parameter vs. statistic", "Parameter", U1, "A parameter describes the population; a statistic describes your sample.", 60, 165, "mastered", M, app(3, 3, true)),
        c("var", "Sampling variability", "Variability", U1, "Different samples give different statistics, even with the same method.", 60, 258, "developing", D, app(1, 1)),
        c("se", "Standard error", "Std. error", U2, "How much a statistic typically moves from sample to sample.", 180, 72, "developing", D, app(1, 1)),
        c("clt", "Central Limit Theorem", "CLT", U2, "Sample means pile up into a normal shape as samples grow.", 180, 165, "mastered", M, app(3, 3, true)),
        c("size", "Effect of sample size", "Sample size", U2, "Bigger samples shrink the standard error, at a square-root rate.", 180, 258, "mastered", M, app(3, 3, true)),
        c("moe", "Margin of error", "Margin", U3, "How far the interval reaches on each side of the estimate.", 300, 72, "mastered", M, app(3, 3, true)),
        c("cic", "CI construction", "Construction", U3, "Build an interval from an estimate, a critical value, and the SE.", 300, 165, "developing", D, app(1, 1)),
        c("cii", "CI interpretation", "Interpretation", U3, "Say what a confidence level does and does not tell you about one interval.", 300, 258, "needs_work", [{ label: "Calculation", pct: 90 }, { label: "Interpretation", pct: 28 }], app(3, 1)),
        c("nul", "Null vs. alternative", "Null / alt", U4, "Frame the claim you are testing and what would count against it.", 420, 72, "not_started", null, app(0, 0)),
        c("pv", "p-value", "p-value", U4, "How surprising your data would be if the null were true.", 420, 165, "not_started", null, app(0, 0)),
        c("err", "Type I / Type II errors", "Error types", U4, "The two ways a test can be wrong, and the trade-off between them.", 420, 258, "not_started", null, app(0, 0)),
      ],
      edges: [["pop", "par"], ["par", "se"], ["var", "se"], ["var", "par"], ["se", "moe"], ["size", "moe"], ["clt", "cic"], ["moe", "cic"], ["cic", "cii"], ["cic", "pv"], ["nul", "pv"], ["pv", "err"]],
    },
    attempts: [],
    provenDays: new Set(),
    seq: 0,
  };
}

const g = globalThis as unknown as { __proveit?: Db };
const db = (): Db => (g.__proveit ??= seed());

// ---- helpers ----

export class NotFoundError extends Error {}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const concept = (id: string) => {
  const c = db().course.concepts.find((x) => x.id === id);
  if (!c) throw new NotFoundError(`concept ${id}`);
  return c;
};
const attempt = (id: string) => {
  const a = db().attempts.find((x) => x.id === id);
  if (!a) throw new NotFoundError(`attempt ${id}`);
  return a;
};
const assertCourse = (id: string) => {
  if (db().course.id !== id) throw new NotFoundError(`course ${id}`);
};
const newId = () => `a${++db().seq}`;

export const coursePct = (cs: Concept[]) =>
  Math.round(((cs.filter((c) => c.state === "mastered").length + 0.5 * cs.filter((c) => c.state === "provisional").length) / cs.length) * 100);

const streak = () => {
  const days = db().provenDays;
  let d = new Date();
  if (!days.has(isoDay(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(isoDay(d))) { n++; d = addDays(d, -1); }
  return n;
};

const testable = (c: Concept) => c.id in AUTHORED;
const upsertSkill = (c: Concept, s: Skill) => {
  const skills = c.skills ?? [];
  c.skills = skills.some((x) => x.label === s.label) ? skills.map((x) => (x.label === s.label ? s : x)) : [...skills, s];
};

function nextConcept(): Concept | null {
  const cs = db().course.concepts.filter(testable);
  return cs.find((c) => c.state === "needs_work") ?? cs.find((c) => c.state === "developing") ?? cs.find((c) => c.state === "not_started") ?? null;
}
const practiceHref = (c: Concept) => `/course/${db().course.id}/practice/${c.id}`;

// ---- views ----

export type DimView = { label: string; level: string; pct: number; tone: Tone };
export type ConceptView = {
  id: string; name: string; short: string; unit: string; desc: string; x: number; y: number;
  state: MasteryState; dims: DimView[]; evidence: string;
  cta: { label: string; href: string | null };
};
export type CourseView = {
  id: string; name: string; deadline: string; pct: number; proven: number; provisional: number; total: number; needsWork: number;
  concepts: ConceptView[]; edges: [string, string][]; nextUp: { id: string; name: string } | null;
};

const dimsFor = (c: Concept): DimView[] => {
  const none = (label: string): DimView => ({ label, level: "NO DATA", pct: 0, tone: "none" });
  if (!c.skills) return [none("Application"), none("New-question test")];
  return c.skills.map((s) => {
    if (s.label === "New-question test") {
      const pass = s.pct >= 70;
      return { label: s.label, level: pass ? "PASSED" : "NOT YET", pct: s.pct, tone: pass ? "good" : "warn" };
    }
    const tone = toneForPct(s.pct);
    return { label: s.label, level: tone === "good" ? "STRONG" : tone === "warn" ? "SOLID" : "WEAK", pct: s.pct, tone };
  });
};

const evidenceText = (c: Concept) =>
  c.evidence.answers === 0 ? "none yet" : c.evidence.transferPassed ? "new question passed" : `${c.evidence.sound} of ${c.evidence.answers} answers sound`;

const ctaFor = (c: Concept): ConceptView["cta"] => {
  if (!testable(c)) return { label: "Not in the demo yet", href: null };
  const label = c.state === "mastered" || c.state === "provisional" ? "Review anyway" : c.state === "not_started" ? "Start this concept" : "Test this concept";
  return { label, href: practiceHref(c) };
};

export function getCourse(courseId: string): CourseView {
  assertCourse(courseId);
  const { course } = db();
  const next = nextConcept();
  return {
    id: course.id, name: course.name, deadline: course.deadline,
    pct: coursePct(course.concepts),
    proven: course.concepts.filter((c) => c.state === "mastered").length,
    provisional: course.concepts.filter((c) => c.state === "provisional").length,
    total: course.concepts.length,
    needsWork: course.concepts.filter((c) => c.state === "needs_work").length,
    concepts: course.concepts.map((c) => ({ id: c.id, name: c.name, short: c.short, unit: c.unit, desc: c.desc, x: c.x, y: c.y, state: c.state, dims: dimsFor(c), evidence: evidenceText(c), cta: ctaFor(c) })),
    edges: course.edges,
    nextUp: next ? { id: next.id, name: next.name } : null,
  };
}

export type SidebarView = { courses: { id: string; name: string; pct: number }[]; streak: number; practiceHref: string | null };
export function getSidebar(): SidebarView {
  const { course } = db();
  const next = nextConcept();
  return { courses: [{ id: course.id, name: course.name, pct: coursePct(course.concepts) }], streak: streak(), practiceHref: next ? practiceHref(next) : null };
}

export type DashboardView = {
  greeting: string; dateLabel: string;
  counts: { proven: number; due: number; needsWork: number; courses: number };
  courses: { id: string; name: string; pct: number; proven: number; total: number; openMisconception: string | null }[];
  risk: { concept: string; reason: string } | null;
  recommendation: string;
  nextActions: { label: string; href: string }[];
  recentlyCaught: { misconception: string; concept: string; repaired: boolean }[];
};

export function getDashboard(): DashboardView {
  const { course, attempts } = db();
  const now = new Date();
  const today = isoDay(now);
  const cs = course.concepts;
  const due = cs.filter((c) => c.nextReview && c.nextReview <= today && (c.state === "provisional" || c.state === "mastered")).length;
  const bad = cs.find((c) => c.state === "needs_work");
  // Seeded needs-work concepts have no attempt yet, so fall back to the authored misconception name.
  const lastBad = (id: string) =>
    [...attempts].reverse().find((a) => a.conceptId === id && a.evaluation?.verdict === "incorrect")?.evaluation?.misconceptionName ?? AUTHORED[id]?.misconception.name ?? null;
  const next = nextConcept();
  const hour = now.getHours();
  const caught = [...attempts].reverse().filter((a) => a.kind === "initial" && a.evaluation?.verdict === "incorrect" && a.evaluation.misconceptionName);
  const seen = new Set<string>();
  const recentlyCaught = caught.filter((a) => (seen.has(a.conceptId) ? false : (seen.add(a.conceptId), true))).slice(0, 3).map((a) => {
    const c = concept(a.conceptId);
    return { misconception: a.evaluation!.misconceptionName!, concept: c.name, repaired: c.evidence.transferPassed && (c.state === "provisional" || c.state === "mastered") };
  });
  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    dateLabel: now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", "").toUpperCase(),
    counts: { proven: cs.filter((c) => c.state === "mastered").length, due, needsWork: cs.filter((c) => c.state === "needs_work").length, courses: 1 },
    courses: [{ id: course.id, name: course.name, pct: coursePct(cs), proven: cs.filter((c) => c.state === "mastered").length, total: cs.length, openMisconception: bad ? lastBad(bad.id) : null }],
    risk: bad ? { concept: `${bad.name} in ${course.name}`, reason: `${lastBad(bad.id) ?? "An open misconception"} is still open. Fix it before ${course.deadline.replace("Quiz ", "the quiz on ")}.` } : null,
    recommendation: next ? `${bad ? "Fix" : "Work on"} ${next.name} next${due > 0 ? ", then clear your reviews" : ""}.` : "Nothing left to test in this demo course.",
    nextActions: next ? [{ label: `Test ${next.name} · ${course.name}`, href: practiceHref(next) }] : [],
    recentlyCaught,
  };
}

export type QuestionView = { courseName: string; conceptId: string; conceptName: string; state: MasteryState; prompt: string; why: string };
export function getQuestion(courseId: string, conceptId: string): QuestionView {
  assertCourse(courseId);
  const c = concept(conceptId);
  const a = AUTHORED[conceptId];
  if (!a) throw new NotFoundError(`no question for ${conceptId}`);
  const skills = c.skills ?? [];
  const weak = [...skills].filter((s) => s.label !== "New-question test").sort((x, y) => x.pct - y.pct)[0];
  const strong = [...skills].filter((s) => s.label !== "New-question test").sort((x, y) => y.pct - x.pct)[0];
  const why =
    c.state === "not_started" ? "You haven't been tested on this yet, so this question sets your starting point."
    : weak && strong && weak !== strong && strong.pct - weak.pct >= 30 ? `${strong.label} is at ${strong.pct}% but ${weak.label} is at ${weak.pct}%, so this checks the meaning, not the mechanics.`
    : "Your answers so far are only partly right. This checks whether the idea holds up in your own words.";
  return { courseName: db().course.name, conceptId, conceptName: c.name, state: c.state, prompt: a.question, why };
}

// ---- assess / diagnose ----

export async function assess(input: AssessInput): Promise<AssessResult> {
  assertCourse(input.courseId);
  const c = concept(input.conceptId);
  const a = AUTHORED[c.id];
  if (!a) throw new NotFoundError(`no content for ${c.id}`);
  const previousState = c.state;
  const judged = input.imageSummary ? `${input.answer}\n\n[Student's attached work, transcribed] ${input.imageSummary}` : input.answer;
  const j = await judgeAnswer(c.id, judged);
  const base: Evaluation = {
    verdict: j.verdict, errorType: "none", misconceptionId: null, misconceptionName: null, evidenceQuote: null, gapSentence: null,
    skills: [], votes: j.votes, followUp: null, recommendation: "",
  };
  let evaluation: Evaluation;
  if (j.verdict === "uncertain") {
    evaluation = { ...base, errorType: "uncertain", followUp: "Add one more sentence. Say what the idea applies to, and why.", recommendation: "One more answer would make the diagnosis reliable." };
  } else if (j.verdict === "incorrect") {
    upsertSkill(c, a.skillOnWrong);
    c.state = "needs_work";
    c.evidence.answers++;
    evaluation = {
      ...base, errorType: "conceptual", misconceptionId: a.misconception.id, misconceptionName: a.misconception.name,
      evidenceQuote: j.quote && input.answer.includes(j.quote) ? j.quote : null, gapSentence: a.misconception.gap,
      skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"),
      recommendation: "A 3-minute lesson on the one idea you missed, then one new question with a different setup.",
    };
  } else {
    upsertSkill(c, a.skillOnRight);
    if (c.state === "not_started" || c.state === "needs_work") c.state = "developing";
    c.evidence.answers++;
    c.evidence.sound++;
    evaluation = { ...base, skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"), recommendation: "Nodes only turn green after a new-question test. Try a different setup to prove it." };
  }
  const rec: Attempt = { id: newId(), courseId: input.courseId, conceptId: c.id, kind: "initial", answer: input.answer, evaluation, passed: false, previousState, failedTransfers: 0, createdAt: Date.now() };
  db().attempts.push(rec);
  return { attemptId: rec.id, evaluation };
}

export type AttemptView = { id: string; courseId: string; conceptId: string; conceptName: string; state: MasteryState; answer: string; evaluation: Evaluation };
export function getAttempt(id: string): AttemptView {
  const a = attempt(id);
  if (!a.evaluation) throw new NotFoundError(`attempt ${id} has no evaluation`);
  const c = concept(a.conceptId);
  return { id: a.id, courseId: a.courseId, conceptId: c.id, conceptName: c.name, state: c.state, answer: a.answer, evaluation: a.evaluation };
}

export function clarify(attemptId: string) {
  const a = attempt(attemptId);
  return { courseId: a.courseId, conceptId: a.conceptId, followUp: "Fair enough. In one or two sentences, say what you meant and what it applies to." };
}

// ---- remediate / transfer ----

export type RemediationView = {
  attemptId: string; courseId: string; conceptName: string; state: MasteryState;
  lesson: { title: string; said: string; actuallyTrue: string; explanation: string; rule: string | null; aiWording: boolean; figure: "ci-intervals" | null };
  transfer: { question: string; hint: string };
};
export function getRemediation(attemptId: string): RemediationView {
  const a = attempt(attemptId);
  const c = concept(a.conceptId);
  const au = AUTHORED[c.id];
  if (!au || a.evaluation?.verdict !== "incorrect") throw new NotFoundError(`nothing to remediate for ${attemptId}`);
  return {
    attemptId, courseId: a.courseId, conceptName: c.name, state: c.state,
    lesson: { title: au.lesson.title, said: a.evaluation.evidenceQuote ?? a.answer, actuallyTrue: au.lesson.actuallyTrue, explanation: au.lesson.explanation, rule: au.lesson.rule, aiWording: false, figure: au.lesson.figure },
    transfer: { question: au.transfer.question, hint: au.transfer.hint },
  };
}

export async function submitTransfer(attemptId: string, answer: string): Promise<TransferResult> {
  const parent = attempt(attemptId);
  const c = concept(parent.conceptId);
  const au = AUTHORED[c.id];
  if (!au) throw new NotFoundError(`no content for ${c.id}`);
  const before = c.state;
  c.evidence.answers++;
  if (await judgeTransfer(c.id, answer)) {
    c.evidence.sound++;
    c.evidence.transferPassed = true;
    upsertSkill(c, au.skillOnRight);
    upsertSkill(c, { label: "New-question test", pct: 85 });
    c.state = "provisional";
    c.nextReview = isoDay(addDays(new Date(), 1));
    db().provenDays.add(isoDay(new Date()));
    const rec: Attempt = { id: newId(), courseId: parent.courseId, conceptId: c.id, kind: "transfer", answer, evaluation: null, passed: true, previousState: before, failedTransfers: parent.failedTransfers, createdAt: Date.now() };
    db().attempts.push(rec);
    return { result: "pass", resultAttemptId: rec.id };
  }
  const j = await judgeAnswer(c.id, answer);
  if (j.verdict === "incorrect") return { result: "fail", nextAttemptId: rediagnose(parent, c.id, answer, j.quote, j.votes), followUp: null };
  return { result: "fail", nextAttemptId: null, followUp: "Not there yet. Open the lesson again, then say in your own words what it means for one calculated case." };
}

/** A failed transfer that restates the misconception becomes a fresh diagnosis; counters carry over. */
function rediagnose(parent: Attempt, conceptId: string, answer: string, quote: string | null, votes: Evaluation["votes"]): string {
  const au = AUTHORED[conceptId]!;
  const c = concept(conceptId);
  const rec: Attempt = {
    id: newId(), courseId: parent.courseId, conceptId, kind: "initial", answer,
    evaluation: {
      verdict: "incorrect", errorType: "conceptual", misconceptionId: au.misconception.id, misconceptionName: au.misconception.name,
      evidenceQuote: quote && answer.includes(quote) ? quote : null, gapSentence: au.misconception.gap,
      skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"), votes, followUp: null,
      recommendation: "Same idea, one more pass. Read the lesson again, then try another setup.",
    },
    passed: false, previousState: c.state, failedTransfers: parent.failedTransfers + 1, createdAt: Date.now(),
  };
  db().attempts.push(rec);
  return rec.id;
}

export type ResultView = {
  courseId: string; courseName: string; conceptName: string; previous: MasteryState; next: MasteryState;
  misconception: string; intervention: string; transferText: string;
  nextReview: string; recommendation: string;
  nextConcept: { name: string; href: string } | null;
  segments: MasteryState[]; coursePct: number; provenLabel: string;
};
const RANK: MasteryState[] = ["mastered", "provisional", "developing", "needs_work", "not_started"];

export function getResult(attemptId: string): ResultView {
  const a = attempt(attemptId);
  if (a.kind !== "transfer" || !a.passed) throw new NotFoundError(`no result for ${attemptId}`);
  const c = concept(a.conceptId);
  const au = AUTHORED[c.id]!;
  const { course } = db();
  const nxt = nextConcept();
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const prov = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: c.state,
    misconception: au.misconception.name,
    intervention: "1 short lesson",
    transferText: a.failedTransfers === 0 ? "Correct on first try" : `Correct after ${a.failedTransfers} earlier ${a.failedTransfers === 1 ? "miss" : "misses"}`,
    nextReview: c.nextReview ? `${c.nextReview === isoDay(addDays(new Date(), 1)) ? "Tomorrow, " : ""}${shortDate(new Date(`${c.nextReview}T00:00:00`))}` : "Not scheduled",
    recommendation: nxt ? `${nxt.name} is next. You're one new question away from proving it.` : "You've covered everything in this demo course.",
    nextConcept: nxt ? { name: nxt.name, href: practiceHref(nxt) } : null,
    segments: [...course.concepts].map((x) => x.state).sort((p, q) => RANK.indexOf(p) - RANK.indexOf(q)),
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} proven + ${prov} provisional`,
  };
}

// ---- mastery review ----

export type ReviewBase = {
  headline: string;
  concepts: { name: string; mastery: number; status: "mastered" | "reteaching" | "transfer-pending" }[];
  riskConcept: string | null;
  nextHref: string | null;
  /** What the model is asked to improve on, and what the UI shows when no model runs. */
  fallback: ReviewText;
  /** Facts handed to the model so it can't invent any. */
  facts: { concept: string; misconception: string | null; quote: string | null }[];
};

const masteryOf = (c: Concept) => (c.skills?.length ? Math.round(c.skills.reduce((n, s) => n + s.pct, 0) / c.skills.length) : 0);

export function getReviewBase(courseId: string): ReviewBase {
  assertCourse(courseId);
  const { course, attempts } = db();
  const concepts = course.concepts.flatMap((c) => {
    const status = cardStatus(c.state);
    return status ? [{ name: c.name, mastery: masteryOf(c), status }] : [];
  });
  const count = (s: string) => concepts.filter((c) => c.status === s).length;
  const d = getDashboard();
  const next = nextConcept();
  const facts = course.concepts.filter((c) => c.state === "needs_work" || c.state === "developing").map((c) => {
    const last = [...attempts].reverse().find((a) => a.conceptId === c.id && a.evaluation?.verdict === "incorrect");
    return { concept: c.name, misconception: last?.evaluation?.misconceptionName ?? (c.state === "needs_work" ? AUTHORED[c.id]?.misconception.name ?? null : null), quote: last?.evaluation?.evidenceQuote ?? null };
  });
  return {
    headline: `${count("mastered")} mastered, ${count("transfer-pending")} awaiting a transfer test, ${count("reteaching")} to reteach`,
    concepts,
    riskConcept: d.risk?.concept ?? null,
    nextHref: next ? practiceHref(next) : null,
    facts,
    fallback: {
      misconceptions: facts.map((f) => ({ concept: f.concept, misconception: f.misconception })),
      biggestRisk: { reason: d.risk?.reason ?? "No open misconceptions right now." },
      recommendation: d.recommendation,
      nextActions: d.nextActions.map((a) => a.label),
    },
  };
}
