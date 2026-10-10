import "server-only";
import { cardStatus, type AssessInput, type AssessResult, type AttemptKind, type AttemptOutcome, type Evaluation, type MasteryState, type ReviewSubmitResult, type ReviewText, type TransferResult } from "@proveit/lib/schemas";
import { toneForPct, type Tone } from "@proveit/lib/mastery";
import { AUTHORED } from "./content";
import { judgeAnswer, judgeReview, judgeTransfer, type AnswerContext } from "./evaluator";
import { loadJson, saveJson } from "./persistence";
import type { CalEvent } from "./calendar";
import { POINTS, STREAK_CAP, standing, TIERS, type Standing } from "@proveit/lib/rewards";
import { demoStateForTests } from "../test/demo-state";

/**
 * The course catalog stays in code for the hackathon, while learner state is persisted through
 * the database seam in persistence.ts. Pages and route handlers only talk to these exported
 * functions, so the storage engine can change without touching the UI.
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
  id: string; courseId: string; conceptId: string; kind: AttemptKind; outcome: AttemptOutcome;
  /** Immediate predecessor and stable episode root let the DB preserve the complete evidence chain. */
  parentAttemptId: string | null; rootAttemptId: string;
  answer: string; imageName?: string; evaluation: Evaluation | null;
  previousState: MasteryState; createdAt: number;
};
/** `completedOverride` is the student's own call. null means derive it from the concepts. */
type Course = { id: string; name: string; deadline: string; concepts: Concept[]; edges: [string, string][]; files: CourseFile[]; completedOverride: boolean | null; /** ISO date of the next quiz, if any. */ examDate: string | null };
/** `course` is the one being worked on. `samples` are finished courses that only fill the sidebar and map views. */
type Db = { course: Course; samples: Course[]; attempts: Attempt[]; provenDays: Set<string>; /** Tasks the student ticked off by hand. */ taskDone: Set<string>; /** Highest point total ever shown. Rank never drops when a concept slips. */ peakPoints: number; seq: number };

const app = (answers: number, sound: number, transferPassed = false) => ({ answers, sound, transferPassed });

function initialState(): Db {
  const c = (id: string, name: string, short: string, unit: string, desc: string, x: number, y: number): Concept =>
    ({ id, name, short, unit, desc, x, y, state: "not_started", skills: null, evidence: app(0, 0), nextReview: null });
  const U1 = "01 SAMPLING", U2 = "02 DISTRIBUTIONS", U3 = "03 CONFIDENCE INTERVALS", U4 = "04 HYPOTHESIS TESTING";
  return {
    course: {
      id: "intro-stats", name: "Intro Statistics", deadline: "Quiz Thursday, Oct 15",
      concepts: [
        c("pop", "Population vs. sample", "Population", U1, "Tell the whole group apart from the part you measured.", 60, 72),
        c("par", "Parameter vs. statistic", "Parameter", U1, "A parameter describes the population; a statistic describes your sample.", 60, 165),
        c("var", "Sampling variability", "Variability", U1, "Different samples give different statistics, even with the same method.", 60, 258),
        c("se", "Standard error", "Std. error", U2, "How much a statistic typically moves from sample to sample.", 180, 72),
        c("clt", "Central Limit Theorem", "CLT", U2, "Sample means pile up into a normal shape as samples grow.", 180, 165),
        c("size", "Effect of sample size", "Sample size", U2, "Bigger samples shrink the standard error, at a square-root rate.", 180, 258),
        c("moe", "Margin of error", "Margin", U3, "How far the interval reaches on each side of the estimate.", 300, 72),
        c("cic", "CI construction", "Construction", U3, "Build an interval from an estimate, a critical value, and the SE.", 300, 165),
        c("cii", "CI interpretation", "Interpretation", U3, "Say what a confidence level does and does not tell you about one interval.", 300, 258),
        c("nul", "Null vs. alternative", "Null / alt", U4, "Frame the claim you are testing and what would count against it.", 420, 72),
        c("pv", "p-value", "p-value", U4, "How surprising your data would be if the null were true.", 420, 165),
        c("err", "Type I / Type II errors", "Error types", U4, "The two ways a test can be wrong, and the trade-off between them.", 420, 258),
      ],
      completedOverride: null,
      examDate: "2026-10-15",
      files: [{ name: "OpenStax Introductory Statistics 2e", kind: "Textbook, CC BY 4.0", detail: "Source for all 12 concepts and the misconceptions they carry." }],
      edges: [["pop", "par"], ["par", "se"], ["var", "se"], ["var", "par"], ["se", "moe"], ["size", "moe"], ["clt", "cic"], ["moe", "cic"], ["cic", "cii"], ["cic", "pv"], ["nul", "pv"], ["pv", "err"]],
    },
    samples: [],
    attempts: [],
    provenDays: new Set(),
    taskDone: new Set(),
    peakPoints: 0,
    seq: 0,
  };
}

type StoredLearning = {
  concepts: Record<string, Pick<Concept, "state" | "skills" | "evidence" | "nextReview">>;
  samples: Course[];
  attempts: Attempt[];
  provenDays: string[];
  taskDone: string[];
  peakPoints: number;
  seq: number;
  completedOverride: boolean | null;
};

function demoRuntimeState(): Db {
  const data = demoStateForTests() as Db;
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const cii = data.course.concepts.find((c) => c.id === "cii")!;
  const se = data.course.concepts.find((c) => c.id === "se")!;
  se.state = "provisional";
  se.skills = [{ label: "Application", pct: 85 }, { label: "New-question test", pct: 90 }, { label: "Retention", pct: 55 }];
  se.evidence = app(3, 2, true);
  se.nextReview = day(0);

  const ciAnswer = "It means there's a 95% probability that the true population mean is inside our interval.";
  const seWrong = "The bigger sample has more standard error because there is more data that can vary.";
  const sePass = "The standard error is cut in half because n is four times larger and sqrt(4) = 2.";
  const base = Date.now() - 2 * 24 * 60 * 60_000;
  data.attempts = [
    {
      id: "a1", courseId: "intro-stats", conceptId: "cii", kind: "initial", outcome: "incorrect",
      parentAttemptId: null, rootAttemptId: "a1", answer: ciAnswer, previousState: "developing", createdAt: base,
      evaluation: {
        verdict: "incorrect", errorType: "conceptual", misconceptionId: "parameter_probability_trap", misconceptionName: "Parameter probability trap",
        evidenceQuote: "95% probability that the true population mean is inside our interval", gapSentence: "The population mean is fixed after the interval is calculated; the 95% describes the repeated method.",
        skills: cii.skills ?? [], votes: { agree: 3, of: 3 }, followUp: null,
        recommendation: "Fix the interpretation gap, then prove it on a different confidence-interval question.",
      },
    },
    {
      id: "a2", courseId: "intro-stats", conceptId: "se", kind: "initial", outcome: "incorrect",
      parentAttemptId: null, rootAttemptId: "a2", answer: seWrong, previousState: "developing", createdAt: base + 60_000,
      evaluation: {
        verdict: "incorrect", errorType: "conceptual", misconceptionId: "more_data_more_error", misconceptionName: "More data means more error",
        evidenceQuote: "bigger sample has more standard error", gapSentence: "Standard error shrinks as sample size grows.",
        skills: [{ label: "Application", pct: 25 }], votes: { agree: 3, of: 3 }, followUp: null,
        recommendation: "Repair the sample-size direction, then try a new setup.",
      },
    },
    {
      id: "a3", courseId: "intro-stats", conceptId: "se", kind: "transfer", outcome: "pass",
      parentAttemptId: "a2", rootAttemptId: "a2", answer: sePass, previousState: "needs_work", createdAt: base + 120_000, evaluation: null,
    },
    {
      id: "a4", courseId: "intro-stats", conceptId: "var", kind: "initial", outcome: "correct",
      parentAttemptId: null, rootAttemptId: "a4", answer: "Different random samples can give different statistics even when the sampling method is unchanged.",
      previousState: "not_started", createdAt: base + 180_000,
      evaluation: {
        verdict: "correct", errorType: "none", misconceptionId: null, misconceptionName: null, evidenceQuote: null, gapSentence: null,
        skills: [{ label: "Application", pct: 75 }], votes: { agree: 3, of: 3 }, followUp: null,
        recommendation: "Prove it on a materially different question before calling it mastered.",
      },
    },
  ];
  data.provenDays = new Set([day(-2), day(-1), day(0)]);
  data.taskDone = new Set(["pv"]);
  data.peakPoints = 6000;
  data.seq = 4;
  return data;
}

function snapshotLearning(current: Db): StoredLearning {
  return {
    concepts: Object.fromEntries(current.course.concepts.map((c) => [c.id, { state: c.state, skills: c.skills, evidence: c.evidence, nextReview: c.nextReview }])),
    samples: current.samples,
    attempts: current.attempts,
    provenDays: [...current.provenDays],
    taskDone: [...current.taskDone],
    peakPoints: current.peakPoints,
    seq: current.seq,
    completedOverride: current.course.completedOverride,
  };
}

function restoreLearning(): Db {
  const stored = loadJson<StoredLearning>("learning");
  if (!stored) {
    const seeded = demoRuntimeState();
    saveJson("learning", snapshotLearning(seeded));
    return seeded;
  }
  const data = initialState();

  for (const concept of data.course.concepts) {
    const saved = stored.concepts?.[concept.id];
    if (saved) Object.assign(concept, saved);
  }
  if (Array.isArray(stored.samples)) data.samples = stored.samples;
  if (Array.isArray(stored.attempts)) data.attempts = stored.attempts;
  if (Array.isArray(stored.provenDays)) data.provenDays = new Set(stored.provenDays);
  if (Array.isArray(stored.taskDone)) data.taskDone = new Set(stored.taskDone);
  if (Number.isFinite(stored.peakPoints)) data.peakPoints = stored.peakPoints;
  if (Number.isFinite(stored.seq)) data.seq = stored.seq;
  if (stored.completedOverride === null || typeof stored.completedOverride === "boolean") data.course.completedOverride = stored.completedOverride;
  return data;
}

type StoreGlobal = { __proveit?: Db; __proveitTestSeedFactory?: () => Db };
const g = globalThis as unknown as StoreGlobal;
const db = (): Db => (g.__proveit ??= process.env.NODE_ENV === "test" && g.__proveitTestSeedFactory ? g.__proveitTestSeedFactory() : restoreLearning());

function persistLearning(): void {
  saveJson("learning", snapshotLearning(db()));
}

// ---- helpers ----

export class NotFoundError extends Error {}
export class InvalidAttemptLinkError extends Error {}
export class ReviewNotDueError extends Error {}

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
/** Any course, including finished samples. Use assertCourse for anything that needs the active course. */
const courseFor = (id: string): Course => {
  const { course, samples } = db();
  const found = course.id === id ? course : samples.find((c) => c.id === id);
  if (!found) throw new NotFoundError(`course ${id}`);
  return found;
};
const assertCourse = (id: string) => {
  if (db().course.id !== id) throw new NotFoundError(`course ${id}`);
};
const newId = () => `a${++db().seq}`;
const primaryMisconception = (conceptId: string) => AUTHORED[conceptId]?.misconceptions[0] ?? null;
const misconceptionFor = (conceptId: string, misconceptionId: string | null) =>
  misconceptionId ? AUTHORED[conceptId]?.misconceptions.find((m) => m.id === misconceptionId) ?? null : null;

function clarificationPromptFor(a: Attempt): string {
  if (a.evaluation?.followUp) return a.evaluation.followUp;
  const m = misconceptionFor(a.conceptId, a.evaluation?.misconceptionId ?? null);
  if (m) return m.clarify;
  return AUTHORED[a.conceptId]?.probe ?? "Say what you meant and what the idea applies to.";
}

function answerContext(parent: Attempt): AnswerContext {
  const previous = db().attempts
    .filter((a) => a.rootAttemptId === parent.rootAttemptId && a.createdAt <= parent.createdAt && a.evaluation)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => ({ answer: a.answer, verdict: a.evaluation!.verdict, misconceptionId: a.evaluation!.misconceptionId }));
  return { previous, followUpPrompt: clarificationPromptFor(parent) };
}

type NewAttempt = Omit<Attempt, "id" | "rootAttemptId" | "parentAttemptId"> & { parentAttemptId?: string | null };
function recordAttempt(data: NewAttempt): Attempt {
  const parent = data.parentAttemptId ? attempt(data.parentAttemptId) : null;
  const id = newId();
  const rec: Attempt = {
    ...data,
    id,
    parentAttemptId: parent?.id ?? null,
    rootAttemptId: parent?.rootAttemptId ?? id,
  };
  db().attempts.push(rec);
  persistLearning();
  return rec;
}

const transferMissesFor = (rootAttemptId: string, beforeOrAt = Number.POSITIVE_INFINITY) =>
  db().attempts.filter((a) => a.rootAttemptId === rootAttemptId && a.kind === "transfer" && a.outcome === "fail" && a.createdAt <= beforeOrAt).length;

const rootHasPassedTransfer = (rootAttemptId: string) =>
  db().attempts.some((a) => a.rootAttemptId === rootAttemptId && a.kind === "transfer" && a.outcome === "pass");

/** Successful-review streak after the latest transfer proof. A new transfer after relearning resets spacing. */
const reviewPassesSinceLatestTransfer = (conceptId: string) => {
  const attempts = db().attempts;
  let latestTransfer = -1;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i]!;
    if (a.conceptId === conceptId && a.kind === "transfer" && a.outcome === "pass") {
      latestTransfer = i;
      break;
    }
  }
  return attempts.slice(latestTransfer + 1).filter((a) => a.conceptId === conceptId && a.kind === "review" && a.outcome === "pass").length;
};

const reviewGapDays = (conceptId: string) => {
  const passed = reviewPassesSinceLatestTransfer(conceptId);
  return passed === 0 ? 7 : passed === 1 ? 14 : 30;
};

function descendsFrom(candidate: Attempt, ancestorId: string): boolean {
  let current: Attempt | null = candidate;
  const seen = new Set<string>();
  while (current?.parentAttemptId) {
    if (current.parentAttemptId === ancestorId) return true;
    if (seen.has(current.parentAttemptId)) return false;
    seen.add(current.parentAttemptId);
    current = db().attempts.find((a) => a.id === current!.parentAttemptId) ?? null;
  }
  return false;
}

/** A correct clarification after a diagnosis means the diagnosis was not confirmed; keep the old event for audit, but don't present it as an open misconception. */
const diagnosisOverturned = (diagnosis: Attempt) =>
  db().attempts.some((a) =>
    a.rootAttemptId === diagnosis.rootAttemptId &&
    a.kind === "clarification" &&
    a.evaluation?.verdict === "correct" &&
    descendsFrom(a, diagnosis.id),
  );

const confirmedIncorrectForRoot = (rootAttemptId: string) =>
  [...db().attempts].reverse().find((a) =>
    a.rootAttemptId === rootAttemptId &&
    a.evaluation?.verdict === "incorrect" &&
    !diagnosisOverturned(a),
  ) ?? null;

const latestConfirmedIncorrect = (conceptId: string) =>
  [...db().attempts].reverse().find((a) =>
    a.conceptId === conceptId &&
    a.evaluation?.verdict === "incorrect" &&
    !diagnosisOverturned(a),
  ) ?? null;

const latestEvaluatedInRoot = (rootAttemptId: string) =>
  [...db().attempts].reverse().find((a) => a.rootAttemptId === rootAttemptId && a.evaluation) ?? null;

const latestAttemptForConcept = (conceptId: string) =>
  [...db().attempts].reverse().find((a) => a.conceptId === conceptId) ?? null;

const rootIsCurrentForConcept = (conceptId: string, rootAttemptId: string) =>
  latestAttemptForConcept(conceptId)?.rootAttemptId === rootAttemptId;

const latestConclusiveForConcept = (conceptId: string) =>
  [...db().attempts].reverse().find((a) => a.conceptId === conceptId && a.evaluation && a.evaluation.verdict !== "uncertain") ?? null;

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

const dueConcepts = () => {
  const today = isoDay(new Date());
  return db().course.concepts.filter((c) => c.nextReview && c.nextReview <= today && (c.state === "provisional" || c.state === "mastered"));
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
  if (!testable(c)) return { label: "Not authored yet", href: null };
  const label = c.state === "mastered" || c.state === "provisional" ? "Review anyway" : c.state === "not_started" ? "Start this concept" : "Test this concept";
  return { label, href: practiceHref(c) };
};

export function getCourse(courseId: string): CourseView {
  const course = courseFor(courseId);
  const active = course === db().course;
  const next = active ? nextConcept() : null;
  return {
    id: course.id, name: course.name, deadline: course.deadline,
    pct: coursePct(course.concepts),
    proven: course.concepts.filter((c) => c.state === "mastered").length,
    provisional: course.concepts.filter((c) => c.state === "provisional").length,
    total: course.concepts.length,
    needsWork: course.concepts.filter((c) => c.state === "needs_work").length,
    concepts: course.concepts.map((c) => ({ id: c.id, name: c.name, short: c.short, unit: c.unit, desc: c.desc, x: c.x, y: c.y, state: c.state, dims: dimsFor(c), evidence: evidenceText(c), cta: active ? ctaFor(c) : { label: c.state === "mastered" ? "Mastered" : "Not authored yet", href: null } })),
    edges: course.edges,
    nextUp: next ? { id: next.id, name: next.name } : null,
  };
}

/** Completed when the student says so, otherwise when every concept is Mastered. Provisional does not count, and an empty course never completes by itself. */
const isCompleted = (c: Course) => c.completedOverride ?? (c.concepts.length > 0 && c.concepts.every((x) => x.state === "mastered"));


export type SidebarView = { courses: { id: string; name: string; pct: number; completed: boolean }[]; streak: number; practiceHref: string | null; reviewsDue: number };
export function getSidebar(): SidebarView {
  const { course, samples } = db();
  const next = nextConcept();
  const row = (c: Course) => ({ id: c.id, name: c.name, pct: coursePct(c.concepts), completed: isCompleted(c) });
  return { courses: [course, ...samples].map(row), streak: streak(), practiceHref: next ? practiceHref(next) : null, reviewsDue: dueConcepts().length };
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
  const cs = course.concepts;
  const due = dueConcepts().length;
  const bad = cs.find((c) => c.state === "needs_work");
  // Seeded needs-work concepts have no attempt yet, so fall back to the authored misconception name.
  const lastBad = (id: string) =>
    latestConfirmedIncorrect(id)?.evaluation?.misconceptionName ?? primaryMisconception(id)?.name ?? null;
  const next = nextConcept();
  const hour = now.getHours();
  const caught = [...attempts].reverse().filter((a) =>
    a.evaluation?.verdict === "incorrect" &&
    a.evaluation.misconceptionName &&
    !diagnosisOverturned(a),
  );
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
    recommendation: next ? `${bad ? "Fix" : "Work on"} ${next.name} next${due > 0 ? ", then clear your reviews" : ""}.` : "Nothing left to test in the currently authored course content.",
    nextActions: next ? [{ label: `Test ${next.name} · ${course.name}`, href: practiceHref(next) }] : [],
    recentlyCaught,
  };
}

export type QuestionView = { courseName: string; conceptId: string; conceptName: string; state: MasteryState; prompt: string; why: string; probe: string; source: string };
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
  return { courseName: db().course.name, conceptId, conceptName: c.name, state: c.state, prompt: a.question, why, probe: a.probe, source: a.lesson.rule?.replace("Rule from course material, ", "") ?? "your course material" };
}

// ---- assess / diagnose ----

export async function assess(input: AssessInput): Promise<AssessResult> {
  assertCourse(input.courseId);
  const c = concept(input.conceptId);
  const a = AUTHORED[c.id];
  if (!a) throw new NotFoundError(`no content for ${c.id}`);

  const parent = input.followUpTo ? attempt(input.followUpTo) : null;
  if (parent && (parent.courseId !== input.courseId || parent.conceptId !== input.conceptId)) {
    throw new InvalidAttemptLinkError("follow-up must stay in the same course and concept");
  }
  if (parent && !parent.evaluation) throw new InvalidAttemptLinkError("follow-up parent has no diagnosable response");
  if (parent && rootHasPassedTransfer(parent.rootAttemptId)) throw new InvalidAttemptLinkError("learning episode is already complete");
  if (parent && !rootIsCurrentForConcept(parent.conceptId, parent.rootAttemptId)) throw new InvalidAttemptLinkError("follow-up episode is stale");
  if (parent && latestEvaluatedInRoot(parent.rootAttemptId)?.id !== parent.id) {
    throw new InvalidAttemptLinkError("follow-up parent is stale");
  }

  const previousState = c.state;
  const judged = input.imageSummary ? `${input.answer}\n\n[Student's attached work, transcribed] ${input.imageSummary}` : input.answer;
  const j = await judgeAnswer(c.id, judged, parent ? answerContext(parent) : undefined);
  // Recheck after the async evaluator so two simultaneous follow-ups cannot both mutate the episode.
  if (parent && (!rootIsCurrentForConcept(parent.conceptId, parent.rootAttemptId) || latestEvaluatedInRoot(parent.rootAttemptId)?.id !== parent.id)) {
    throw new InvalidAttemptLinkError("follow-up parent became stale");
  }
  const base: Evaluation = {
    verdict: j.verdict, errorType: "none", misconceptionId: null, misconceptionName: null, evidenceQuote: null, gapSentence: null,
    skills: [], votes: j.votes, followUp: null, recommendation: "",
  };
  const diagnosed = j.misconceptionId ? a.misconceptions.find((m) => m.id === j.misconceptionId) ?? null : null;
  let evaluation: Evaluation;
  if (j.verdict === "uncertain" || (j.verdict === "incorrect" && !diagnosed)) {
    evaluation = { ...base, verdict: "uncertain", errorType: "uncertain", followUp: "Add one more sentence. Say what the idea applies to, and why.", recommendation: "One more answer would make the diagnosis reliable." };
  } else if (j.verdict === "incorrect") {
    upsertSkill(c, a.skillOnWrong);
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    c.evidence.answers++;
    evaluation = {
      ...base, errorType: "conceptual", misconceptionId: diagnosed!.id, misconceptionName: diagnosed!.name,
      evidenceQuote: j.quote && input.answer.includes(j.quote) ? j.quote : null, gapSentence: diagnosed!.gap,
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
  const rec = recordAttempt({
    courseId: input.courseId, conceptId: c.id, kind: parent ? "clarification" : "initial", outcome: evaluation.verdict,
    parentAttemptId: parent?.id ?? null, answer: input.answer, imageName: input.imageSummary ? input.imageName : undefined,
    evaluation, previousState, createdAt: Date.now(),
  });
  return { attemptId: rec.id, evaluation };
}

export type EvidenceAttemptView = {
  id: string; courseId: string; conceptId: string; kind: AttemptKind; outcome: AttemptOutcome;
  parentAttemptId: string | null; rootAttemptId: string; answer: string; evaluation: Evaluation | null;
  previousState: MasteryState; createdAt: number;
};
/** Raw evidence view: unlike the diagnosis view, transfer passes and non-diagnostic misses are valid records. */
export function getEvidenceAttempt(id: string): EvidenceAttemptView {
  const a = attempt(id);
  return {
    id: a.id, courseId: a.courseId, conceptId: a.conceptId, kind: a.kind, outcome: a.outcome,
    parentAttemptId: a.parentAttemptId, rootAttemptId: a.rootAttemptId, answer: a.answer, evaluation: a.evaluation,
    previousState: a.previousState, createdAt: a.createdAt,
  };
}

export function getEvidenceTrail(id: string): EvidenceAttemptView[] {
  const current = attempt(id);
  return db().attempts
    .filter((a) => a.rootAttemptId === current.rootAttemptId)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => getEvidenceAttempt(a.id));
}

export type AttemptView = {
  id: string; courseId: string; conceptId: string; conceptName: string; question: string; state: MasteryState; answer: string; attachment: string | null; evaluation: Evaluation;
  kind: AttemptKind; outcome: AttemptOutcome; parentAttemptId: string | null; rootAttemptId: string; createdAt: number;
};
export function getAttempt(id: string): AttemptView {
  const a = attempt(id);
  if (!a.evaluation) throw new NotFoundError(`attempt ${id} has no evaluation`);
  const c = concept(a.conceptId);
  return {
    id: a.id, courseId: a.courseId, conceptId: c.id, conceptName: c.name, question: AUTHORED[c.id]?.question ?? "", state: c.state,
    answer: a.answer, attachment: a.imageName ?? null, evaluation: a.evaluation,
    kind: a.kind, outcome: a.outcome, parentAttemptId: a.parentAttemptId, rootAttemptId: a.rootAttemptId, createdAt: a.createdAt,
  };
}

export function clarify(attemptId: string) {
  const a = attempt(attemptId);
  if (!a.evaluation) throw new NotFoundError(`attempt ${attemptId} has no evaluation to clarify`);
  if (rootHasPassedTransfer(a.rootAttemptId)) throw new InvalidAttemptLinkError("learning episode is already complete");
  if (!rootIsCurrentForConcept(a.conceptId, a.rootAttemptId) || latestEvaluatedInRoot(a.rootAttemptId)?.id !== a.id) {
    throw new InvalidAttemptLinkError("clarification source is stale");
  }
  return { courseId: a.courseId, conceptId: a.conceptId, followUp: clarificationPromptFor(a) };
}

// ---- remediate / transfer ----

export type RemediationView = {
  attemptId: string; courseId: string; conceptId: string; conceptName: string; state: MasteryState;
  lesson: { title: string; said: string; actuallyTrue: string; explanation: string; rule: string | null; aiWording: boolean; figure: "ci-intervals" | null };
  transfer: { question: string; hint: string };
};
export function getRemediation(attemptId: string): RemediationView {
  const a = attempt(attemptId);
  const c = concept(a.conceptId);
  const au = AUTHORED[c.id];
  if (!au || a.evaluation?.verdict !== "incorrect") throw new NotFoundError(`nothing to remediate for ${attemptId}`);
  return {
    attemptId, courseId: a.courseId, conceptId: c.id, conceptName: c.name, state: c.state,
    lesson: { title: au.lesson.title, said: a.evaluation.evidenceQuote ?? a.answer, actuallyTrue: au.lesson.actuallyTrue, explanation: au.lesson.explanation, rule: au.lesson.rule, aiWording: false, figure: au.lesson.figure },
    transfer: { question: au.transfer.question, hint: au.transfer.hint },
  };
}

export type TransferChallengeView = {
  attemptId: string; courseId: string; conceptId: string; conceptName: string; state: MasteryState;
  transfer: { question: string; hint: string };
};

export function getTransferChallenge(attemptId: string): TransferChallengeView {
  const source = attempt(attemptId);
  const c = concept(source.conceptId);
  const au = AUTHORED[c.id];
  if (!au || source.evaluation?.verdict !== "correct") throw new NotFoundError(`no direct transfer challenge for ${attemptId}`);
  if (!rootIsCurrentForConcept(c.id, source.rootAttemptId) || latestConclusiveForConcept(c.id)?.id !== source.id) {
    throw new NotFoundError(`stale transfer challenge ${attemptId}`);
  }
  if (rootHasPassedTransfer(source.rootAttemptId)) {
    throw new NotFoundError(`transfer already passed for ${attemptId}`);
  }
  return {
    attemptId: source.id, courseId: source.courseId, conceptId: c.id, conceptName: c.name, state: c.state,
    transfer: { question: au.transfer.question, hint: au.transfer.hint },
  };
}

export async function submitTransfer(attemptId: string, answer: string): Promise<TransferResult> {
  const parent = attempt(attemptId);
  const c = concept(parent.conceptId);
  const au = AUTHORED[c.id];
  if (!au) throw new NotFoundError(`no content for ${c.id}`);
  if (!rootIsCurrentForConcept(c.id, parent.rootAttemptId) || latestConclusiveForConcept(c.id)?.id !== parent.id) {
    throw new InvalidAttemptLinkError("transfer source is stale");
  }
  if (rootHasPassedTransfer(parent.rootAttemptId)) {
    throw new InvalidAttemptLinkError("this evidence chain already passed its transfer test");
  }
  const before = c.state;
  const judged = await judgeTransfer(c.id, answer);
  if (!rootIsCurrentForConcept(c.id, parent.rootAttemptId) || latestConclusiveForConcept(c.id)?.id !== parent.id) {
    throw new InvalidAttemptLinkError("transfer source became stale");
  }
  if (db().attempts.some((a) => a.rootAttemptId === parent.rootAttemptId && a.kind === "transfer" && a.outcome === "pass")) {
    throw new InvalidAttemptLinkError("this evidence chain already passed its transfer test");
  }
  c.evidence.answers++;
  if (judged.verdict === "pass") {
    c.evidence.sound++;
    c.evidence.transferPassed = true;
    upsertSkill(c, au.skillOnRight);
    upsertSkill(c, { label: "New-question test", pct: 85 });
    c.state = "provisional";
    c.nextReview = isoDay(addDays(new Date(), 1));
    db().provenDays.add(isoDay(new Date()));
    const rec = recordAttempt({
      courseId: parent.courseId, conceptId: c.id, kind: "transfer", outcome: "pass", parentAttemptId: parent.id,
      answer, evaluation: null, previousState: before, createdAt: Date.now(),
    });
    return { result: "pass", resultAttemptId: rec.id };
  }

  const diagnosed = misconceptionFor(c.id, judged.misconceptionId);
  let evaluation: Evaluation;
  let followUp: string | null = null;
  if (judged.verdict === "fail" && diagnosed) {
    upsertSkill(c, au.skillOnWrong);
    upsertSkill(c, { label: "New-question test", pct: 25 });
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    evaluation = {
      verdict: "incorrect", errorType: "conceptual", misconceptionId: diagnosed.id, misconceptionName: diagnosed.name,
      evidenceQuote: judged.quote && answer.includes(judged.quote) ? judged.quote : null, gapSentence: diagnosed.gap,
      skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"), votes: judged.votes, followUp: null,
      recommendation: "The new setup exposed the same underlying gap. Repair that idea, then prove it again on another setup.",
    };
  } else {
    followUp = judged.feedback ?? "Give one more precise sentence that addresses every part of the question.";
    evaluation = {
      verdict: "uncertain", errorType: "uncertain", misconceptionId: null, misconceptionName: null,
      evidenceQuote: null, gapSentence: null, skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"),
      votes: judged.votes, followUp, recommendation: "There is not enough evidence to name a misconception yet.",
    };
  }
  const rec = recordAttempt({
    courseId: parent.courseId, conceptId: c.id, kind: "transfer", outcome: "fail", parentAttemptId: parent.id,
    answer, evaluation, previousState: before, createdAt: Date.now(),
  });
  return { result: "fail", failedAttemptId: rec.id, nextAttemptId: evaluation.verdict === "incorrect" ? rec.id : null, followUp };
}

export type ResultView = {
  courseId: string; courseName: string; conceptName: string; previous: MasteryState; next: MasteryState;
  diagnosisLabel: string; misconception: string; intervention: string; transferText: string;
  nextReview: string; recommendation: string;
  nextConcept: { name: string; href: string } | null;
  segments: MasteryState[]; coursePct: number; provenLabel: string;
  points: { label: string; points: number }[];
};
const RANK: MasteryState[] = ["mastered", "provisional", "developing", "needs_work", "not_started"];

export function getResult(attemptId: string): ResultView {
  const a = attempt(attemptId);
  if (a.kind !== "transfer" || a.outcome !== "pass") throw new NotFoundError(`no result for ${attemptId}`);
  const c = concept(a.conceptId);
  const { course, attempts } = db();
  const diagnoses = attempts.filter((x) => x.rootAttemptId === a.rootAttemptId && x.evaluation?.verdict === "incorrect");
  const confirmed = confirmedIncorrectForRoot(a.rootAttemptId);
  const hadOverturnedDiagnosis = diagnoses.length > 0 && !confirmed;
  const diagnosed = confirmed?.evaluation?.misconceptionName ?? null;
  const earlierMisses = transferMissesFor(a.rootAttemptId, a.createdAt);
  const nxt = nextConcept();
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const prov = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: "provisional",
    diagnosisLabel: diagnosed ? "Misconception found" : "Diagnosis",
    misconception: diagnosed ?? (hadOverturnedDiagnosis ? "Not confirmed after clarification" : "None detected"),
    intervention: diagnosed ? "1 short lesson" : hadOverturnedDiagnosis ? "Clarified the diagnosis" : "No remediation needed",
    transferText: earlierMisses === 0 ? "Correct on first try" : `Correct after ${earlierMisses} earlier ${earlierMisses === 1 ? "miss" : "misses"}`,
    nextReview: c.nextReview ? `${c.nextReview === isoDay(addDays(new Date(), 1)) ? "Tomorrow, " : ""}${shortDate(new Date(`${c.nextReview}T00:00:00`))}` : "Not scheduled",
    recommendation: nxt ? `${nxt.name} is next. You're one new question away from proving it.` : "You've covered everything currently authored for this course.",
    nextConcept: nxt ? { name: nxt.name, href: practiceHref(nxt) } : null,
    segments: [...course.concepts].map((x) => x.state).sort((p, q) => RANK.indexOf(p) - RANK.indexOf(q)),
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} proven + ${prov} provisional`,
    points: [
      { label: "Proved the concept", points: POINTS.proved },
      ...(confirmed ? [{ label: "Repaired a misconception", points: POINTS.repaired }] : []),
      ...(earlierMisses === 0 ? [{ label: "Passed on the first try", points: POINTS.firstTry }] : []),
    ],
  };
}

// ---- mastery review ----

export type ReviewBase = {
  headline: string;
  attemptCount: number;
  concepts: { name: string; mastery: number; status: "mastered" | "reteaching" | "transfer-pending" }[];
  riskConcept: string | null;
  riskName: string | null;
  nextHref: string | null;
  /** What the model is asked to improve on, and what the UI shows when no model runs. */
  fallback: ReviewText;
  /** Facts handed to the model so it can't invent any. */
  facts: { concept: string; misconception: string | null; quote: string | null }[];
};

const masteryOf = (c: Concept) => (c.skills?.length ? Math.round(c.skills.reduce((n, s) => n + s.pct, 0) / c.skills.length) : 0);

export function getReviewBase(courseId: string): ReviewBase {
  const course = courseFor(courseId);
  const active = course === db().course;
  const concepts = course.concepts.flatMap((c) => {
    const status = cardStatus(c.state);
    return status ? [{ name: c.name, mastery: masteryOf(c), status }] : [];
  });
  const count = (s: string) => concepts.filter((c) => c.status === s).length;
  const d = getDashboard();
  const next = active ? nextConcept() : null;
  const facts = course.concepts.filter((c) => c.state === "needs_work" || c.state === "developing").map((c) => {
    const last = latestConfirmedIncorrect(c.id);
    return { concept: c.name, misconception: last?.evaluation?.misconceptionName ?? (c.state === "needs_work" ? primaryMisconception(c.id)?.name ?? null : null), quote: last?.evaluation?.evidenceQuote ?? null };
  });
  return {
    attemptCount: course.concepts.reduce((n, c) => n + c.evidence.answers, 0),
    headline: `${count("mastered")} mastered, ${count("transfer-pending")} awaiting a transfer test, ${count("reteaching")} to reteach`,
    concepts,
    riskConcept: active ? d.risk?.concept ?? null : null,
    riskName: course.concepts.find((c) => c.state === "needs_work")?.name ?? null,
    nextHref: next ? practiceHref(next) : null,
    facts,
    fallback: {
      misconceptions: facts.map((f) => ({ concept: f.concept, misconception: f.misconception })),
      biggestRisk: { reason: active ? d.risk?.reason ?? "No open misconceptions right now." : "No open misconceptions in this course." },
      recommendation: active ? d.recommendation : isCompleted(course) ? "This course is complete. Come back for reviews when they are due." : "This course does not have authored practice content yet.",
      nextActions: active ? d.nextActions.map((a) => a.label) : [],
    },
  };
}

// ---- review queue, history, misconception log, files ----

export type ReviewItem = { id: string; name: string; courseName: string; when: string; /** ISO day the review lands. */ day: string; due: boolean; href: string | null };
export function getReviews(now = new Date()): { due: ReviewItem[]; upcoming: ReviewItem[] } {
  const { course } = db();
  const today = isoDay(now);
  const items = course.concepts.filter((c) => c.nextReview && (c.state === "provisional" || c.state === "mastered")).map((c) => {
    const due = c.nextReview! <= today;
    return {
      id: c.id, name: c.name, courseName: course.name, day: c.nextReview!, due,
      href: due && testable(c) ? `/course/${course.id}/review/${c.id}` : null,
      when: due ? "Due now" : shortDate(new Date(`${c.nextReview}T00:00:00`)),
    };
  });
  return { due: items.filter((i) => i.due), upcoming: items.filter((i) => !i.due) };
}

export type ReviewChallengeView = {
  courseId: string; conceptId: string; conceptName: string; state: MasteryState; dueDay: string;
  review: { question: string; hint: string };
};

const reviewIsDue = (c: Concept, now: Date) =>
  !!c.nextReview && (c.state === "provisional" || c.state === "mastered") && c.nextReview <= isoDay(now);

export function getReviewChallenge(courseId: string, conceptId: string, now = new Date()): ReviewChallengeView {
  assertCourse(courseId);
  const c = concept(conceptId);
  const au = AUTHORED[c.id];
  if (!au || !reviewIsDue(c, now)) throw new NotFoundError(`no due review for ${conceptId}`);
  return {
    courseId, conceptId: c.id, conceptName: c.name, state: c.state, dueDay: c.nextReview!,
    review: { question: au.review.question, hint: au.review.hint },
  };
}

export async function submitReview(courseId: string, conceptId: string, answer: string, now = new Date()): Promise<ReviewSubmitResult> {
  assertCourse(courseId);
  const c = concept(conceptId);
  const au = AUTHORED[c.id];
  if (!au) throw new NotFoundError(`no review content for ${conceptId}`);
  if (!reviewIsDue(c, now)) throw new ReviewNotDueError("That review isn't due yet.");
  const previousState = c.state;
  const expectedDay = c.nextReview;
  const expectedLatestAttempt = latestAttemptForConcept(c.id)?.id ?? null;
  const judged = await judgeReview(c.id, answer);
  if (c.state !== previousState || c.nextReview !== expectedDay || (latestAttemptForConcept(c.id)?.id ?? null) !== expectedLatestAttempt) {
    throw new InvalidAttemptLinkError("review state changed while evaluating");
  }

  c.evidence.answers++;
  if (judged.verdict === "pass") {
    c.evidence.sound++;
    c.evidence.transferPassed = true;
    upsertSkill(c, au.skillOnRight);
    upsertSkill(c, { label: "Retention", pct: 90 });
    c.state = "mastered";
    c.nextReview = isoDay(addDays(now, reviewGapDays(c.id)));
    db().provenDays.add(isoDay(now));
    const rec = recordAttempt({
      courseId, conceptId: c.id, kind: "review", outcome: "pass", answer, evaluation: null,
      previousState, createdAt: now.getTime(),
    });
    return { result: "pass", resultAttemptId: rec.id };
  }

  const diagnosed = misconceptionFor(c.id, judged.misconceptionId);
  if (judged.verdict === "fail" && diagnosed) {
    upsertSkill(c, au.skillOnWrong);
    upsertSkill(c, { label: "Retention", pct: 25 });
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    c.nextReview = null;
    const evaluation: Evaluation = {
      verdict: "incorrect", errorType: "conceptual", misconceptionId: diagnosed.id, misconceptionName: diagnosed.name,
      evidenceQuote: judged.quote && answer.includes(judged.quote) ? judged.quote : null, gapSentence: diagnosed.gap,
      skills: c.skills ?? [], votes: judged.votes, followUp: null,
      recommendation: "The delayed check exposed the gap again. Repair it, then prove it on a fresh transfer question.",
    };
    const rec = recordAttempt({
      courseId, conceptId: c.id, kind: "review", outcome: "fail", answer, evaluation,
      previousState, createdAt: now.getTime(),
    });
    return { result: "fail", failedAttemptId: rec.id, nextAttemptId: rec.id };
  }

  const followUp = judged.feedback ?? "Give one more precise answer that addresses every part of the review.";
  const evaluation: Evaluation = {
    verdict: "uncertain", errorType: "uncertain", misconceptionId: null, misconceptionName: null,
    evidenceQuote: null, gapSentence: null, skills: c.skills ?? [], votes: judged.votes, followUp,
    recommendation: "There is not enough evidence to change mastery yet.",
  };
  const rec = recordAttempt({
    courseId, conceptId: c.id, kind: "review", outcome: "uncertain", answer, evaluation,
    previousState, createdAt: now.getTime(),
  });
  return { result: "uncertain", attemptId: rec.id, followUp };
}

export type ReviewResultView = {
  courseId: string; courseName: string; conceptName: string; previous: MasteryState; next: "mastered";
  nextReview: string; pointsEarned: number; coursePct: number; provenLabel: string;
};

export function getReviewResult(attemptId: string): ReviewResultView {
  const a = attempt(attemptId);
  if (a.kind !== "review" || a.outcome !== "pass") throw new NotFoundError(`no review result for ${attemptId}`);
  const c = concept(a.conceptId);
  const { course } = db();
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const provisional = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: "mastered",
    nextReview: c.nextReview ? shortDate(new Date(`${c.nextReview}T00:00:00`)) : "Not scheduled",
    pointsEarned: a.previousState === "provisional" ? POINTS.mastered - POINTS.proved : 0,
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} mastered${provisional ? ` + ${provisional} provisional` : ""}`,
  };
}

export type HistoryEvent = { id: string; at: number; title: string; detail: string; tone: "good" | "warn" | "bad"; href: string };
export function getHistory(): HistoryEvent[] {
  const { attempts } = db();
  return [...attempts].reverse().map((a) => {
    const c = concept(a.conceptId);
    const base = `/course/${a.courseId}`;
    if (a.kind === "review" && a.outcome === "pass") return { id: a.id, at: a.createdAt, title: `Passed delayed review on ${c.name}`, detail: "Mastered with delayed retrieval", tone: "good" as const, href: `${base}/review-result/${a.id}` };
    if (a.kind === "review" && a.outcome === "fail" && a.evaluation?.verdict === "incorrect") return { id: a.id, at: a.createdAt, title: `Review exposed a gap in ${c.name}`, detail: `Caught: ${a.evaluation.misconceptionName}`, tone: "bad" as const, href: `${base}/diagnosis/${a.id}` };
    if (a.kind === "review" && a.outcome === "uncertain") return { id: a.id, at: a.createdAt, title: `Reviewed ${c.name}`, detail: "Needs more evidence", tone: "warn" as const, href: "/review" };
    if (a.kind === "transfer" && a.outcome === "pass") return { id: a.id, at: a.createdAt, title: `Passed the new question on ${c.name}`, detail: "Now provisionally mastered", tone: "good" as const, href: `${base}/result/${a.id}` };
    if (a.kind === "transfer" && a.outcome === "fail" && a.evaluation?.verdict === "incorrect") return { id: a.id, at: a.createdAt, title: `Missed the new question on ${c.name}`, detail: `Caught: ${a.evaluation.misconceptionName}`, tone: "bad" as const, href: `${base}/diagnosis/${a.id}` };
    if (a.kind === "transfer" && a.outcome === "fail") {
      const parent = a.parentAttemptId ? attempt(a.parentAttemptId) : null;
      const href = parent?.evaluation?.verdict === "correct"
        ? `${base}/transfer/${parent.id}`
        : `${base}/lesson/${parent?.id ?? a.rootAttemptId}`;
      return { id: a.id, at: a.createdAt, title: `Tried the new question on ${c.name}`, detail: "Needs more evidence", tone: "warn" as const, href };
    }
    const v = a.evaluation?.verdict;
    const verb = a.kind === "clarification" ? "Clarified" : "Answered";
    if (v === "incorrect") return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: `Caught: ${a.evaluation?.misconceptionName}`, tone: "bad" as const, href: `${base}/diagnosis/${a.id}` };
    if (v === "correct") return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: "No misconception found", tone: "good" as const, href: `${base}/diagnosis/${a.id}` };
    return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: "Needed one more answer", tone: "warn" as const, href: `${base}/practice/${c.id}?clarify=${a.id}` };
  });
}

export type MisconceptionEntry = { key: string; name: string; concept: string; quote: string | null; open: boolean; note: string; href: string };
export function getMisconceptionLog(courseId: string): MisconceptionEntry[] {
  const course = courseFor(courseId);
  const { attempts } = db();
  return course.concepts.flatMap((c) => {
    const au = AUTHORED[c.id];
    if (!au) return [];
    return au.misconceptions.flatMap((m, index) => {
      const last = [...attempts].reverse().find((a) =>
        a.conceptId === c.id &&
        a.evaluation?.verdict === "incorrect" &&
        a.evaluation.misconceptionId === m.id &&
        !diagnosisOverturned(a),
      );
      const seededOpen = c.state === "needs_work" && index === 0 && !attempts.some((a) => a.conceptId === c.id && a.evaluation?.verdict === "incorrect");
      if (!last && !seededOpen) return [];
      const repaired = c.evidence.transferPassed && c.state !== "needs_work";
      return [{
        key: `${c.id}:${m.id}`, name: m.name, concept: c.name, quote: last?.evaluation?.evidenceQuote ?? null, open: !repaired,
        note: repaired ? "Fixed with a lesson and a new question" : last ? "Open until you pass a new question" : "From your earlier attempts",
        href: last && !repaired ? `/course/${courseId}/lesson/${last.id}` : practiceHref(c),
      }];
    });
  });
}

export type CourseFile = { name: string; kind: string; detail: string };
export function getFiles(courseId: string): { courseName: string; files: CourseFile[] } {
  const course = courseFor(courseId);
  return { courseName: course.name, files: course.files };
}

// ---- courses list ----

export type CourseRow = {
  id: string; name: string; pct: number; proven: number; total: number; needsWork: number;
  /** Developing or provisional: started, not yet mastered. */ inProgress: number; notStarted: number; next: string | null;
  completed: boolean; /** true when the student set it, false when every concept got Mastered on its own */ manual: boolean;
  openMisconception: string | null;
};

export function listCourses(): CourseRow[] {
  const { course, samples } = db();
  return [course, ...samples].map((c) => {
    const bad = c.concepts.find((x) => x.state === "needs_work");
    const last = bad && (latestConfirmedIncorrect(bad.id)?.evaluation?.misconceptionName ?? primaryMisconception(bad.id)?.name ?? null);
    return {
      id: c.id, name: c.name, pct: coursePct(c.concepts),
      proven: c.concepts.filter((x) => x.state === "mastered").length, total: c.concepts.length,
      needsWork: c.concepts.filter((x) => x.state === "needs_work").length,
      inProgress: c.concepts.filter((x) => x.state === "developing" || x.state === "provisional").length,
      notStarted: c.concepts.filter((x) => x.state === "not_started").length,
      next: (c === course ? nextConcept() : null)?.name ?? c.concepts.find((x) => x.state !== "mastered")?.name ?? null,
      completed: isCompleted(c), manual: c.completedOverride !== null,
      openMisconception: last || null,
    };
  });
}

/** Marks courses completed or back in progress. Unknown ids reject the whole batch so nothing half-applies. */
export function setCoursesCompleted(ids: string[], completed: boolean): string[] {
  const found = ids.map((id) => courseFor(id));
  for (const c of found) c.completedOverride = completed;
  persistLearning();
  return found.map((c) => c.id);
}

// ---- dashboard widgets ----

// ---- to-do list ----

export type Task = {
  id: string; title: string; courseId: string; courseName: string; state: MasteryState; kind: "practice" | "review";
  done: boolean; /** "progress" means your answers finished it, so it can't be unticked. */ doneBy: "progress" | "you" | null;
  href: string | null; why: string;
};
export type TodoGroup = { courseId: string; courseName: string; open: Task[]; done: Task[]; total: number; doneCount: number };

export class TaskLockedError extends Error {}

export const taskRank = (t: Task) => (t.kind === "review" ? 1 : t.state === "needs_work" ? 0 : t.state === "developing" ? 2 : 3);

function tasksFor(c: Course, active: boolean): Task[] {
  const today = isoDay(new Date());
  return c.concepts.flatMap((x): Task[] => {
    const provedByWork = x.state === "provisional" || x.state === "mastered";
    const href = active && testable(x) ? practiceHref(x) : null;
    const practice: Task = {
      id: x.id, title: x.name, courseId: c.id, courseName: c.name, state: x.state, kind: "practice",
      done: provedByWork || db().taskDone.has(x.id), doneBy: provedByWork ? "progress" : db().taskDone.has(x.id) ? "you" : null, href,
      why: x.state === "needs_work" ? "Open misconception" : x.state === "developing" ? "Started, not yet proved" : x.state === "not_started" ? "Not started" : "Proved",
    };
    const reviewDue = x.nextReview && x.nextReview <= today && provedByWork;
    const review: Task[] = reviewDue ? [{ id: `review:${x.id}`, title: `Review ${x.name}`, courseId: c.id, courseName: c.name, state: x.state, kind: "review", done: db().taskDone.has(`review:${x.id}`), doneBy: db().taskDone.has(`review:${x.id}`) ? "you" : null, href, why: "Review due" }] : [];
    return [practice, ...review];
  });
}

/** Tasks grouped by course, open ones first by urgency. Completed courses drop out. */
export function getTodos(): TodoGroup[] {
  const { course, samples } = db();
  return [course, ...samples].filter((c) => !isCompleted(c)).map((c) => {
    const all = tasksFor(c, c === course);
    const open = all.filter((t) => !t.done).sort((a, b) => taskRank(a) - taskRank(b));
    return { courseId: c.id, courseName: c.name, open, done: all.filter((t) => t.done), total: all.length, doneCount: all.filter((t) => t.done).length };
  });
}

/** Ticks or unticks a task by hand. Progress-based completion can't be undone, and a hand tick never changes mastery. */
export function setTaskDone(id: string, done: boolean): void {
  const { course, samples } = db();
  const task = [course, ...samples].flatMap((c) => tasksFor(c, c === course)).find((t) => t.id === id);
  if (!task) throw new NotFoundError(`task ${id}`);
  if (task.doneBy === "progress") throw new TaskLockedError("Your answers already completed this task.");
  if (done) db().taskDone.add(id);
  else db().taskDone.delete(id);
  persistLearning();
}

// ---- events that come from courses ----

/** Quizzes and due reviews as all-day events, so the calendar shows them next to the student's own. */
export function getCourseEvents(): CalEvent[] {
  const { course, samples } = db();
  const out: CalEvent[] = [];
  for (const c of [course, ...samples]) {
    if (isCompleted(c)) continue;
    if (c.examDate) out.push({ id: `quiz:${c.id}`, title: c.deadline.replace(/^Quiz /, `${c.name} quiz, `), start: new Date(`${c.examDate}T00:00:00`).toISOString(), end: new Date(`${c.examDate}T23:59:59`).toISOString(), allDay: true, kind: "quiz", href: `/course/${c.id}` });
    for (const x of c.concepts) {
      if (!x.nextReview || !(x.state === "provisional" || x.state === "mastered")) continue;
      out.push({ id: `review:${x.id}`, title: `Review ${x.name}`, start: new Date(`${x.nextReview}T00:00:00`).toISOString(), end: new Date(`${x.nextReview}T23:59:59`).toISOString(), allDay: true, kind: "review", href: "/review" });
    }
  }
  return out;
}

// ---- rank ----

export type Rewards = Standing & {
  breakdown: { label: string; count: number; each: number; points: number }[];
  ladder: { id: string; name: string; min: number; reached: boolean; current: boolean }[];
};

/**
 * Points derived from current evidence, so the same data always gives the same number. Repaired and first-try
 * bonuses count once per concept so a deliberate wrong answer can't be cycled for points. Rank keeps the
 * highest total ever shown: a concept slipping back doesn't take a tier away.
 */
export function getRewards(): Rewards {
  const { course, samples, attempts } = db();
  const concepts = [course, ...samples].flatMap((c) => c.concepts);
  const passed = attempts.filter((a) => a.kind === "transfer" && a.outcome === "pass");
  const repairedConcepts = new Set(
    passed.filter((a) => confirmedIncorrectForRoot(a.rootAttemptId)).map((a) => a.conceptId),
  );
  const firstTryConcepts = new Set(
    passed.filter((a) => transferMissesFor(a.rootAttemptId, a.createdAt) === 0).map((a) => a.conceptId),
  );
  const rows = [
    { label: "Concepts mastered", count: concepts.filter((c) => c.state === "mastered").length, each: POINTS.mastered },
    { label: "Concepts proved with a new question", count: concepts.filter((c) => c.state === "provisional").length, each: POINTS.proved },
    { label: "Misconceptions repaired", count: repairedConcepts.size, each: POINTS.repaired },
    { label: "Passed a new question first try", count: firstTryConcepts.size, each: POINTS.firstTry },
    { label: "Courses mastered end to end", count: [course, ...samples].filter((c) => c.completedOverride === null && c.concepts.length > 0 && c.concepts.every((x) => x.state === "mastered")).length, each: POINTS.course },
    { label: "Streak days, up to 7", count: Math.min(streak(), STREAK_CAP), each: POINTS.streakDay },
  ].map((r) => ({ ...r, points: r.count * r.each }));
  const earned = rows.reduce((n, r) => n + r.points, 0);
  const previousPeak = db().peakPoints;
  db().peakPoints = Math.max(previousPeak, earned);
  if (db().peakPoints !== previousPeak) persistLearning();
  const s = standing(db().peakPoints);
  return { ...s, breakdown: rows, ladder: TIERS.map((t, i) => ({ id: t.id, name: t.name, min: t.min, reached: i <= s.tierIndex, current: i === s.tierIndex })) };
}
