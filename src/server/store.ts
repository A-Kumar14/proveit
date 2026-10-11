import { userCache } from "./userScope";
import "server-only";
import { cardStatus, type AssessInput, type AssessResult, type AttemptKind, type AttemptOutcome, type CourseOutline, type Evaluation, type MasteryState, type ReviewSubmitResult, type AssessmentReward, type ReviewText, type TransferResult } from "@proveit/lib/schemas";
import { toneForPct, type Tone } from "@proveit/lib/mastery";
import { judgeAnswerForSpec, judgeReviewForSpec, judgeTransferForSpec, type AnswerContext } from "./evaluator";
import { ensureConceptLearningSpec } from "./learningSpecGenerator";
import { getLearningSpec } from "./learningSpecStore";
import type { ConceptLearningSpec } from "@proveit/lib/conceptLearningSpec";
import { followUpFor, GENERIC_FOLLOWUP } from "./followup";
import { loadUserJson, saveUserJson } from "./persistence";
import type { CourseSpec } from "@proveit/lib/courseSpec";
import type { CalEvent } from "./calendar";
import { courseTiers, standing, TIERS, type Standing } from "@proveit/lib/rewards";
import { awardAssessment, awardCourseBonus, emptyRewardLedger, makeCourseRewards, rewardFingerprint, rewardName, type RewardLedger, type RewardTopic } from "./rewardLedger";
import { aiEnabled } from "./ai";
import { learningSourceViews, sourceIdUnion, type LearningSourceView } from "./sourceLineage";

/**
 * The course catalog stays in code for the hackathon, while learner state is persisted through
 * the database seam in persistence.ts. Pages and route handlers only talk to these exported
 * functions, so the storage engine can change without touching the UI.
 */

type Skill = { label: string; pct: number };
type Concept = {
  id: string; name: string; short: string; unit: string; desc: string; x: number; y: number;
  importance?: number;
  state: MasteryState;
  skills: Skill[] | null;
  evidence: { answers: number; sound: number; transferPassed: boolean };
  nextReview: string | null;
};
type Attempt = {
  assessmentReward?: AssessmentReward;
  id: string; courseId: string; conceptId: string; kind: AttemptKind; outcome: AttemptOutcome;
  /** Immediate predecessor and stable episode root let the DB preserve the complete evidence chain. */
  parentAttemptId: string | null; rootAttemptId: string;
  /** Exact canonical learning-spec revision used to judge this evidence. Optional only for legacy persisted attempts. */
  learningSpecRevision?: number;
  answer: string; imageName?: string; evaluation: Evaluation | null;
  previousState: MasteryState; createdAt: number;
};
/** `completedOverride` is the student's own call. null means derive it from the concepts. */
type Course = { rewardIdentity?: string; id: string; name: string; deadline: string; concepts: Concept[]; edges: [string, string][]; files: CourseFile[]; completedOverride: boolean | null; /** ISO date of the next quiz, if any. */ examDate: string | null; /** True for courses added at runtime (uploads, imports, the curated catalog). Their canonical learning content is generated on demand. */ runtime?: boolean; /** The notes a curated course was built from. */ spec?: CourseSpec };
/** `course` is the one being worked on. `samples` are every other course (added at runtime, plus placeholders in tests): including runtime courses with generated practice content. */
type Db = { rewardLedger?: RewardLedger; course: Course; samples: Course[]; /** Every quiz taken, with what it changed. Absent in snapshots saved before quizzes were recorded. */ quizzes?: QuizRecord[]; attempts: Attempt[]; provenDays: Set<string>; /** Tasks the student ticked off by hand. */ taskDone: Set<string>; /** Highest point total ever shown. Rank never drops when a concept slips. */ peakPoints: number; /** Same rule per course, so a course's rank never drops either. */ peakByCourse: Record<string, number>; seq: number };

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
    peakByCourse: {},
    seq: 0,
  };
}

type StoredLearning = {
  rewardLedger?: RewardLedger;
  concepts: Record<string, Pick<Concept, "state" | "skills" | "evidence" | "nextReview">>;
  attempts: Attempt[];
  quizzes?: QuizRecord[];
  provenDays: string[];
  taskDone: string[];
  peakPoints: number;
  peakByCourse?: Record<string, number>;
  seq: number;
  completedOverride: boolean | null;
  /** Courses built from uploads. Optional so snapshots saved before uploads existed still load. */
  courses?: Course[];
};

function restoreLearning(): Db {
  const data = initialState();
  const stored = loadUserJson<StoredLearning>("learning");
  if (!stored) return data;

  for (const concept of data.course.concepts) {
    const saved = stored.concepts?.[concept.id];
    if (saved) Object.assign(concept, saved);
  }
  if (stored.rewardLedger?.version === 2) data.rewardLedger = stored.rewardLedger;
  if (Array.isArray(stored.attempts)) data.attempts = stored.attempts;
  if (Array.isArray(stored.quizzes)) data.quizzes = stored.quizzes;
  if (Array.isArray(stored.provenDays)) data.provenDays = new Set(stored.provenDays);
  if (Array.isArray(stored.taskDone)) data.taskDone = new Set(stored.taskDone);
  if (Number.isFinite(stored.peakPoints)) data.peakPoints = stored.peakPoints;
  if (stored.peakByCourse && typeof stored.peakByCourse === "object") data.peakByCourse = { ...stored.peakByCourse };
  if (Number.isFinite(stored.seq)) data.seq = stored.seq;
  if (stored.completedOverride === null || typeof stored.completedOverride === "boolean") data.course.completedOverride = stored.completedOverride;
  if (Array.isArray(stored.courses)) data.samples = stored.courses;
  return data;
}

type StoreGlobal = { __proveit?: Db; __proveitTestSeedFactory?: () => Db };
const g = globalThis as unknown as StoreGlobal;
const db = (): Db => userCache("learning", () => (g.__proveit ??= process.env.NODE_ENV === "test" && g.__proveitTestSeedFactory ? g.__proveitTestSeedFactory() : restoreLearning()), restoreLearning);

function persistLearning(): void {
  const current = db();
  const snapshot: StoredLearning = {
    concepts: Object.fromEntries(current.course.concepts.map((c) => [c.id, { state: c.state, skills: c.skills, evidence: c.evidence, nextReview: c.nextReview }])),
    rewardLedger: current.rewardLedger,
    attempts: current.attempts,
    quizzes: current.quizzes ?? [],
    provenDays: [...current.provenDays],
    taskDone: [...current.taskDone],
    peakPoints: current.peakPoints,
    peakByCourse: current.peakByCourse,
    seq: current.seq,
    completedOverride: current.course.completedOverride,
    courses: current.samples,
  };
  saveUserJson("learning", snapshot);
}

// ---- courses added at runtime ----

const unitLabel = (name: string, i: number) => `${String(i + 1).padStart(2, "0")} ${name.toUpperCase()}`;

function courseFromSpec(spec: CourseSpec): Course {
  let n = 0;
  const concepts = spec.units.flatMap((u, ui): Concept[] => u.concepts.map((c) => {
    n++;
    return { id: `${spec.id}-${n}`, name: c.name, importance: c.importance, short: c.name.length > 14 ? `${c.name.slice(0, 13).trimEnd()}.` : c.name, unit: unitLabel(u.name, ui), desc: c.desc, x: 0, y: 0, state: "not_started", skills: null, evidence: { answers: 0, sound: 0, transferPassed: false }, nextReview: null };
  }));
  return {
    rewardIdentity: rewardFingerprint(spec.material || spec.units.flatMap(u => u.concepts.map(c => c.name)).sort().join("|")),
    id: spec.id, name: spec.name, deadline: "No quiz scheduled", concepts, edges: [], completedOverride: null, examDate: null, runtime: true, spec,
    files: [{ name: `${spec.name} course notes`, kind: spec.source === "catalog" ? "Curated course" : "Your course", detail: spec.summary }],
  };
}

/** Adds a course built from notes. Adding the same id twice changes nothing. */
export function addCourseSpec(spec: CourseSpec): { id: string; added: boolean } {
  const data = db();
  if (data.course.id === spec.id || data.samples.some((c) => c.id === spec.id)) return { id: spec.id, added: false };
  const added = courseFromSpec(spec);
  data.samples.push(added);
  rewardsForCourse(added);
  persistLearning();
  return { id: spec.id, added: true };
}

/** Removes a course added at runtime. The demo course and test placeholders can't be removed. */
export function removeAddedCourse(id: string): boolean {
  const data = db();
  const i = data.samples.findIndex((c) => c.id === id && c.runtime);
  if (i < 0) return false;
  const removed = data.samples[i]!;
  data.samples.splice(i, 1);
  data.quizzes = (data.quizzes ?? []).filter((q) => q.courseId !== id);
  data.attempts = data.attempts.filter((attempt) => attempt.courseId !== id);
  for (const concept of removed.concepts) {
    data.taskDone.delete(concept.id);
    data.taskDone.delete(`review:${concept.id}`);
  }
  if (data.peakByCourse) delete data.peakByCourse[id];
  persistLearning();
  return true;
}

export const addedCourseIds = (): string[] => db().samples.flatMap((c) => (c.spec ? [c.id] : []));

/** The notes a course was built from, or null for a course with authored content only. */
export function courseSpec(courseId: string): CourseSpec | null {
  return courseFor(courseId).spec ?? null;
}

// ---- helpers ----

export class NotFoundError extends Error {}
export class InvalidAttemptLinkError extends Error {}
export class ReviewNotDueError extends Error {}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const attempt = (id: string) => {
  const a = db().attempts.find((x) => x.id === id);
  if (!a) throw new NotFoundError(`attempt ${id}`);
  return a;
};
/** Any course, including the built-in course and courses added from uploads/imports. */
const courseFor = (id: string): Course => {
  const { course, samples } = db();
  const found = course.id === id ? course : samples.find((c) => c.id === id);
  if (!found) throw new NotFoundError(`course ${id}`);
  return found;
};
/** In-flight operations must reject a deleted/replaced course, even if its slug is reused. */
export const courseInstance = (courseId: string): object => courseFor(courseId);

const conceptFor = (courseId: string, conceptId: string): Concept => {
  const c = courseFor(courseId).concepts.find((x) => x.id === conceptId);
  if (!c) throw new NotFoundError(`concept ${conceptId}`);
  return c;
};
const newId = () => `a${++db().seq}`;

const specFor = (courseId: string, conceptId: string, revision?: number): ConceptLearningSpec => {
  const spec = getLearningSpec(courseId, conceptId, revision);
  if (!spec) throw new NotFoundError(`no learning content for ${conceptId}`);
  return spec;
};
const specForAttempt = (a: Attempt): ConceptLearningSpec =>
  specFor(a.courseId, a.conceptId, a.learningSpecRevision);
const misconceptionForSpec = (spec: ConceptLearningSpec, misconceptionId: string | null) =>
  misconceptionId ? spec.misconceptions.find((m) => m.id === misconceptionId) ?? null : null;
const primaryMisconceptionFor = (courseId: string, conceptId: string) =>
  getLearningSpec(courseId, conceptId)?.misconceptions[0] ?? null;

function sourceViewsForAttempt(a: Attempt): LearningSourceView[] {
  // Legacy attempts without a pinned revision and low-stakes quiz signals cannot claim exact source lineage.
  if (a.kind === "quiz" || a.learningSpecRevision === undefined) return [];
  const spec = specFor(a.courseId, a.conceptId, a.learningSpecRevision);
  const sectionIds =
    a.kind === "transfer" ? spec.transfer.sourceIds :
    a.kind === "review" ? spec.review.sourceIds :
    spec.assessment.sourceIds;
  const diagnosed = misconceptionForSpec(spec, a.evaluation?.misconceptionId ?? null);
  return learningSourceViews(spec, sourceIdUnion(sectionIds, diagnosed?.sourceIds ?? []));
}

function clarificationPromptFor(a: Attempt): string {
  if (a.evaluation?.followUp) return a.evaluation.followUp;
  const spec = specForAttempt(a);
  const m = misconceptionForSpec(spec, a.evaluation?.misconceptionId ?? null);
  if (m) return m.clarificationQuestion;
  return spec.assessment.probe ?? "Say what you meant and what the idea applies to.";
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
  if (rec.assessmentReward) {
    const course = courseFor(rec.courseId);
    rec.assessmentReward = awardAssessment(rewardsForCourse(course), conceptFor(rec.courseId, rec.conceptId).name, "explanation", rec.assessmentReward.score, 1, rec.id);
    if (rec.evaluation) rec.evaluation.assessmentReward = rec.assessmentReward;
  }
  db().attempts.push(rec);
  if (rec.kind === "review" && rec.outcome === "pass") checkCourseBonus(courseFor(rec.courseId), rec.id);
  persistLearning();
  return rec;
}

export type QuizEvidenceObservation = {
  conceptId: string;
  prompt: string;
  selected: string;
  correct: boolean;
};

/**
 * Multiple-choice quiz answers are supporting evidence only.
 * They can establish that a concept has been seen, but never diagnose a misconception,
 * prove transfer, schedule review, directly award rank points, or demote stronger mastery states.
 */
export function recordQuizEvidence(courseId: string, observations: QuizEvidenceObservation[], at = Date.now()): string[] {
  const course = courseFor(courseId);
  const ids: string[] = [];
  for (const observation of observations) {
    const c = course.concepts.find((concept) => concept.id === observation.conceptId);
    if (!c) throw new NotFoundError(`concept ${observation.conceptId}`);

    const previousState = c.state;
    c.evidence.answers++;
    if (observation.correct) c.evidence.sound++;
    if (c.state === "not_started") c.state = "developing";

    const id = newId();
    const rec: Attempt = {
      id,
      courseId,
      conceptId: c.id,
      kind: "quiz",
      outcome: observation.correct ? "correct" : "incorrect",
      parentAttemptId: null,
      rootAttemptId: id,
      answer: `Question: ${observation.prompt}\nSelected: ${observation.selected}`,
      evaluation: null,
      previousState,
      createdAt: at,
    };
    db().attempts.push(rec);
    ids.push(id);
  }
  if (observations.length) persistLearning();
  return ids;
}

export type QuizSignal = { right: number; total: number; pct: number; lastAt: number };

/** Recent quiz performance is a prioritization hint, never a mastery verdict. */
export function getQuizSignal(courseId: string, conceptId: string, limit = 5): QuizSignal | null {
  courseFor(courseId);
  const rows = [...db().attempts]
    .reverse()
    .filter((a) => a.courseId === courseId && a.conceptId === conceptId && a.kind === "quiz")
    .slice(0, Math.max(1, limit));
  if (!rows.length) {
    // Quizzes taken through the quiz page are stored as quiz records, newest last.
    const seen = (db().quizzes ?? []).filter((q) => q.courseId === courseId).flatMap((q) => q.items.filter((it) => it.conceptId === conceptId && it.picked !== null).map((it) => ({ ok: it.picked === it.correct, at: q.at })));
    const recent = seen.slice(-Math.max(1, limit));
    if (!recent.length) return null;
    const ok = recent.filter((r) => r.ok).length;
    return { right: ok, total: recent.length, pct: Math.round((ok / recent.length) * 100), lastAt: Math.max(...recent.map((r) => r.at)) };
  }
  const right = rows.filter((a) => a.outcome === "correct").length;
  return {
    right,
    total: rows.length,
    pct: Math.round((right / rows.length) * 100),
    lastAt: Math.max(...rows.map((a) => a.createdAt)),
  };
}

const transferMissesFor = (rootAttemptId: string, beforeOrAt = Number.POSITIVE_INFINITY) =>
  db().attempts.filter((a) => a.rootAttemptId === rootAttemptId && a.kind === "transfer" && a.outcome === "fail" && a.createdAt <= beforeOrAt).length;

const rootHasPassedTransfer = (rootAttemptId: string) =>
  db().attempts.some((a) => a.rootAttemptId === rootAttemptId && a.kind === "transfer" && a.outcome === "pass");

/** Successful-review streak after the latest transfer proof. A new transfer after relearning resets spacing. */
const reviewPassesSinceLatestTransfer = (conceptId: string, courseId?: string) => {
  const attempts = db().attempts;
  const sameConcept = (a: Attempt) => a.conceptId === conceptId && (!courseId || a.courseId === courseId);
  let latestTransfer = -1;
  for (let i = attempts.length - 1; i >= 0; i--) {
    const a = attempts[i]!;
    if (sameConcept(a) && a.kind === "transfer" && a.outcome === "pass") {
      latestTransfer = i;
      break;
    }
  }
  return attempts.slice(latestTransfer + 1).filter((a) => sameConcept(a) && a.kind === "review" && a.outcome === "pass").length;
};

const reviewGapDays = (conceptId: string, courseId?: string) => {
  const passed = reviewPassesSinceLatestTransfer(conceptId, courseId);
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

const latestConfirmedIncorrect = (conceptId: string, courseId?: string) =>
  [...db().attempts].reverse().find((a) =>
    a.conceptId === conceptId &&
    (!courseId || a.courseId === courseId) &&
    a.evaluation?.verdict === "incorrect" &&
    !diagnosisOverturned(a),
  ) ?? null;

const latestEvaluatedInRoot = (rootAttemptId: string) =>
  [...db().attempts].reverse().find((a) => a.rootAttemptId === rootAttemptId && a.evaluation) ?? null;

/** Low-stakes quiz signals never supersede an in-flight assess/clarify/transfer/review episode. */
const latestAttemptForConcept = (conceptId: string, courseId?: string) =>
  [...db().attempts].reverse().find((a) =>
    a.kind !== "quiz" &&
    a.conceptId === conceptId &&
    (!courseId || a.courseId === courseId)
  ) ?? null;

const rootIsCurrentForConcept = (conceptId: string, rootAttemptId: string, courseId?: string) =>
  latestAttemptForConcept(conceptId, courseId)?.rootAttemptId === rootAttemptId;

const latestConclusiveForConcept = (conceptId: string, courseId?: string) =>
  [...db().attempts].reverse().find((a) =>
    a.conceptId === conceptId &&
    (!courseId || a.courseId === courseId) &&
    a.evaluation &&
    a.evaluation.verdict !== "uncertain"
  ) ?? null;

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

const allCourses = (): Course[] => [db().course, ...db().samples];

const dueConcepts = () => {
  const today = isoDay(new Date());
  return allCourses().flatMap((course) =>
    course.concepts
      .filter((c) => c.nextReview && c.nextReview <= today && (c.state === "provisional" || c.state === "mastered"))
      .map((concept) => ({ course, concept }))
  );
};

const testableIn = (courseId: string, c: Concept) => Boolean(getLearningSpec(courseId, c.id));
const canPractice = (course: Course, c: Concept) => testableIn(course.id, c) || (course.runtime === true && aiEnabled());
const upsertSkill = (c: Concept, skill: Skill) => {
  const skills = c.skills ?? [];
  c.skills = skills.some((x) => x.label === skill.label)
    ? skills.map((x) => (x.label === skill.label ? skill : x))
    : [...skills, skill];
};

function nextConceptFor(course: Course): Concept | null {
  const cs = course.concepts.filter((c) => canPractice(course, c));
  return cs.find((c) => c.state === "needs_work") ??
    cs.find((c) => c.state === "developing") ??
    cs.find((c) => c.state === "not_started") ??
    null;
}
function nextAcrossCourses(): { course: Course; concept: Concept } | null {
  const courses = allCourses().filter((course) => !isCompleted(course));
  for (const state of ["needs_work", "developing", "not_started"] as const) {
    for (const course of courses) {
      const concept = course.concepts.find((candidate) => candidate.state === state && canPractice(course, candidate));
      if (concept) return { course, concept };
    }
  }
  return null;
}
const practiceHrefFor = (courseId: string, c: Concept) => `/course/${courseId}/practice/${c.id}`;

// ---- views ----

export type DimView = { label: string; level: string; pct: number; tone: Tone };
export type ConceptView = {
  rewards?: RewardTopic;
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

const ctaFor = (course: Course, c: Concept): ConceptView["cta"] => {
  if (!canPractice(course, c)) {
    return course.runtime
      ? { label: "Study with the tutor", href: `/course/${course.id}/tutor` }
      : { label: "Not authored yet", href: null };
  }
  const label = c.state === "mastered" || c.state === "provisional"
    ? "Review anyway"
    : c.state === "not_started"
      ? "Start this concept"
      : "Test this concept";
  return { label, href: practiceHrefFor(course.id, c) };
};

export function getCourse(courseId: string): CourseView {
  const course = courseFor(courseId);
  const next = nextConceptFor(course);
  return {
    id: course.id, name: course.name, deadline: course.deadline,
    pct: coursePct(course.concepts),
    proven: course.concepts.filter((c) => c.state === "mastered").length,
    provisional: course.concepts.filter((c) => c.state === "provisional").length,
    total: course.concepts.length,
    needsWork: course.concepts.filter((c) => c.state === "needs_work").length,
    concepts: course.concepts.map((c) => ({
      id: c.id, name: c.name, short: c.short, unit: c.unit, desc: c.desc, x: c.x, y: c.y,
      rewards: rewardsForCourse(course).topics[rewardName(c.name)],
      state: c.state, dims: dimsFor(c), evidence: evidenceText(c), cta: ctaFor(course, c),
    })),
    edges: course.edges,
    nextUp: next ? { id: next.id, name: next.name } : null,
  };
}

/** Completed when the student says so, otherwise when every concept is Mastered. Provisional does not count, and an empty course never completes by itself. */
const isCompleted = (c: Course) => c.completedOverride ?? (c.concepts.length > 0 && c.concepts.every((x) => x.state === "mastered"));


export type SidebarView = { courses: { id: string; name: string; pct: number; completed: boolean }[]; streak: number; practiceHref: string | null; reviewsDue: number };
export function getSidebar(): SidebarView {
  const courses = allCourses();
  const next = nextAcrossCourses();
  const row = (c: Course) => ({ id: c.id, name: c.name, pct: coursePct(c.concepts), completed: isCompleted(c) });
  return {
    courses: courses.map(row),
    streak: streak(),
    practiceHref: next ? practiceHrefFor(next.course.id, next.concept) : null,
    reviewsDue: dueConcepts().length,
  };
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
  const { attempts } = db();
  const courses = allCourses();
  const concepts = courses.flatMap((course) => course.concepts.map((concept) => ({ course, concept })));
  const now = new Date();
  const due = dueConcepts().length;
  const bad = concepts.find(({ concept }) => concept.state === "needs_work") ?? null;
  const next = nextAcrossCourses();
  const lastBad = (courseId: string, conceptId: string) =>
    latestConfirmedIncorrect(conceptId, courseId)?.evaluation?.misconceptionName ??
    primaryMisconceptionFor(courseId, conceptId)?.name ??
    null;
  const hour = now.getHours();
  const caught = [...attempts].reverse().filter((a) =>
    a.evaluation?.verdict === "incorrect" &&
    a.evaluation.misconceptionName &&
    !diagnosisOverturned(a),
  );
  const seen = new Set<string>();
  const recentlyCaught = caught
    .filter((a) => {
      const key = `${a.courseId}:${a.conceptId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((a) => {
      const c = conceptFor(a.courseId, a.conceptId);
      return {
        misconception: a.evaluation!.misconceptionName!,
        concept: c.name,
        repaired: c.evidence.transferPassed && (c.state === "provisional" || c.state === "mastered"),
      };
    });

  const courseRows = courses.map((course) => {
    const open = course.concepts.find((concept) => concept.state === "needs_work");
    return {
      id: course.id,
      name: course.name,
      pct: coursePct(course.concepts),
      proven: course.concepts.filter((concept) => concept.state === "mastered").length,
      total: course.concepts.length,
      openMisconception: open ? lastBad(course.id, open.id) : null,
    };
  });

  const badReason = bad
    ? bad.course.deadline.startsWith("Quiz ")
      ? `${lastBad(bad.course.id, bad.concept.id) ?? "An open misconception"} is still open. Fix it before ${bad.course.deadline.replace("Quiz ", "the quiz on ")}.`
      : `${lastBad(bad.course.id, bad.concept.id) ?? "An open misconception"} is still open. Repair it before moving on.`
    : null;

  return {
    greeting: hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    dateLabel: now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", "").toUpperCase(),
    counts: {
      proven: concepts.filter(({ concept }) => concept.state === "mastered").length,
      due,
      needsWork: concepts.filter(({ concept }) => concept.state === "needs_work").length,
      courses: courses.length,
    },
    courses: courseRows,
    risk: bad ? { concept: `${bad.concept.name} in ${bad.course.name}`, reason: badReason! } : null,
    recommendation: next
      ? `${bad ? "Fix" : "Work on"} ${next.concept.name} in ${next.course.name} next${due > 0 ? ", then clear your reviews" : ""}.`
      : due > 0
        ? "Your concept work is clear; finish the reviews that are due."
        : "Nothing is waiting for mastery evidence right now.",
    nextActions: next ? [{
      label: `Test ${next.concept.name} · ${next.course.name}`,
      href: practiceHrefFor(next.course.id, next.concept),
    }] : [],
    recentlyCaught,
  };
}

export type QuestionView = {
  courseName: string; conceptId: string; conceptName: string; state: MasteryState;
  prompt: string; why: string; probe: string; source: string; sources: LearningSourceView[]; learningSpecRevision?: number;
};
export function getQuestion(courseId: string, conceptId: string, revision?: number): QuestionView {
  const course = courseFor(courseId);
  const c = conceptFor(courseId, conceptId);
  const spec = specFor(courseId, conceptId, revision);
  const skills = c.skills ?? [];
  const weak = [...skills].filter((s) => s.label !== "New-question test").sort((x, y) => x.pct - y.pct)[0];
  const strong = [...skills].filter((s) => s.label !== "New-question test").sort((x, y) => y.pct - x.pct)[0];
  const why =
    c.state === "not_started" ? "You haven't been tested on this yet, so this question sets your starting point."
    : weak && strong && weak !== strong && strong.pct - weak.pct >= 30 ? `${strong.label} is at ${strong.pct}% but ${weak.label} is at ${weak.pct}%, so this checks the meaning, not the mechanics.`
    : "Your answers so far are only partly right. This checks whether the idea holds up in your own words.";
  const firstSource = spec.sources.find((source) => spec.assessment.sourceIds.includes(source.id));
  return {
    courseName: course.name,
    conceptId,
    conceptName: c.name,
    state: c.state,
    learningSpecRevision: spec.revision,
    prompt: spec.assessment.question,
    why,
    probe: spec.assessment.probe,
    source: firstSource?.title ?? "your course material",
    sources: learningSourceViews(spec, spec.assessment.sourceIds),
  };
}

/** Generate runtime-course content on demand, then return the same question view used for authored content. */
export async function ensureQuestion(courseId: string, conceptId: string): Promise<QuestionView> {
  const course = courseFor(courseId);
  if (course.runtime) await ensureConceptLearningSpec(courseId, conceptId);
  return getQuestion(courseId, conceptId);
}

// ---- assess / diagnose ----

export async function assess(input: AssessInput): Promise<AssessResult> {
  const c = conceptFor(input.courseId, input.conceptId);

  const parent = input.followUpTo ? attempt(input.followUpTo) : null;
  if (parent && (parent.courseId !== input.courseId || parent.conceptId !== input.conceptId)) {
    throw new InvalidAttemptLinkError("follow-up must stay in the same course and concept");
  }
  if (parent && !parent.evaluation) throw new InvalidAttemptLinkError("follow-up parent has no diagnosable response");
  if (parent && rootHasPassedTransfer(parent.rootAttemptId)) throw new InvalidAttemptLinkError("learning episode is already complete");
  if (parent && !rootIsCurrentForConcept(parent.conceptId, parent.rootAttemptId, parent.courseId)) {
    throw new InvalidAttemptLinkError("follow-up episode is stale");
  }
  if (parent && latestEvaluatedInRoot(parent.rootAttemptId)?.id !== parent.id) {
    throw new InvalidAttemptLinkError("follow-up parent is stale");
  }

  // Clarifications stay on the exact revision that produced the original diagnosis.
  // Built-in concepts remain fail-closed unless they have canonical authored content; only runtime courses generate on demand.
  const course = courseFor(input.courseId);
  const spec = parent
    ? specForAttempt(parent)
    : course.runtime
      ? await ensureConceptLearningSpec(input.courseId, input.conceptId)
      : specFor(input.courseId, input.conceptId);
  if (input.learningSpecRevision !== undefined && input.learningSpecRevision !== spec.revision) {
    throw new InvalidAttemptLinkError("assessment content changed; refresh the question");
  }
  const previousState = c.state;
  const judged = input.imageSummary ? `${input.answer}\n\n[Student's attached work, transcribed] ${input.imageSummary}` : input.answer;
  const j = await judgeAnswerForSpec(spec, judged, parent ? answerContext(parent) : undefined);
  // Written before the recheck below, so nothing awaits between the recheck and recording the attempt.
  const nextQuestion = j.verdict === "uncertain" || (j.verdict === "incorrect" && !misconceptionForSpec(spec, j.misconceptionId))
    ? await followUpFor(spec.assessment.question, input.answer)
    : null;

  // Recheck after the async evaluator so stale/concurrent requests cannot mutate a replaced course or episode.
  if (conceptFor(input.courseId, input.conceptId) !== c) {
    throw new InvalidAttemptLinkError("course state changed while evaluating");
  }
  if (parent && (
    !rootIsCurrentForConcept(parent.conceptId, parent.rootAttemptId, parent.courseId) ||
    latestEvaluatedInRoot(parent.rootAttemptId)?.id !== parent.id
  )) {
    throw new InvalidAttemptLinkError("follow-up parent became stale");
  }

  const base: Evaluation = {
    verdict: j.verdict, errorType: "none", misconceptionId: null, misconceptionName: null, evidenceQuote: null, gapSentence: null,
    skills: [], votes: j.votes, followUp: null, recommendation: "",
  };
  const diagnosed = misconceptionForSpec(spec, j.misconceptionId);
  let evaluation: Evaluation;
  if (j.verdict === "uncertain" || (j.verdict === "incorrect" && !diagnosed)) {
    evaluation = {
      ...base,
      verdict: "uncertain",
      errorType: "uncertain",
      followUp: nextQuestion ?? GENERIC_FOLLOWUP,
      recommendation: "One more answer would make the diagnosis reliable.",
    };
  } else if (j.verdict === "incorrect") {
    upsertSkill(c, spec.skills.onWrong);
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    c.evidence.answers++;
    evaluation = {
      ...base,
      errorType: "conceptual",
      misconceptionId: diagnosed!.id,
      misconceptionName: diagnosed!.name,
      evidenceQuote: j.quote && input.answer.includes(j.quote) ? j.quote : null,
      gapSentence: diagnosed!.description,
      skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"),
      recommendation: "A short lesson on the one idea you missed, then one new question with a different setup.",
    };
  } else {
    upsertSkill(c, spec.skills.onRight);
    if (c.state === "not_started" || c.state === "needs_work") c.state = "developing";
    c.evidence.answers++;
    c.evidence.sound++;
    evaluation = {
      ...base,
      skills: (c.skills ?? []).filter((s) => s.label !== "New-question test"),
      recommendation: "Nodes only turn green after a new-question test. Try a different setup to prove it.",
    };
  }

  const evidenceId = `a${db().seq + 1}`;
  evaluation.assessmentReward = awardAssessment(rewardsForCourse(course), c.name, "explanation", j.score ?? null, 1, evidenceId);
  if (j.score !== null && j.score !== undefined) upsertSkill(c, { label: "Explanation assessment", pct: j.score });
  const rec = recordAttempt({
    courseId: input.courseId,
    conceptId: c.id,
    kind: parent ? "clarification" : "initial",
    outcome: evaluation.verdict,
    parentAttemptId: parent?.id ?? null,
    learningSpecRevision: spec.revision,
    answer: input.answer,
    imageName: input.imageSummary ? input.imageName : undefined,
    evaluation,
    previousState,
    createdAt: Date.now(),
  });
  const plan = rewardsForCourse(course);
  for (const award of plan.awards) if (award.evidenceId === evidenceId) award.evidenceId = rec.id;
  checkCourseBonus(course, rec.id);
  persistLearning();
  return { attemptId: rec.id, evaluation };
}

export type EvidenceAttemptView = {
  assessmentReward?: AssessmentReward;
  id: string; courseId: string; conceptId: string; kind: AttemptKind; outcome: AttemptOutcome;
  parentAttemptId: string | null; rootAttemptId: string; learningSpecRevision: number | null; answer: string; evaluation: Evaluation | null;
  sources: LearningSourceView[]; previousState: MasteryState; createdAt: number;
};
/** Raw evidence view: unlike the diagnosis view, transfer passes and non-diagnostic misses are valid records. */
export function getEvidenceAttempt(id: string): EvidenceAttemptView {
  const a = attempt(id);
  return {
    id: a.id, courseId: a.courseId, conceptId: a.conceptId, kind: a.kind, outcome: a.outcome,
    parentAttemptId: a.parentAttemptId, rootAttemptId: a.rootAttemptId, learningSpecRevision: a.learningSpecRevision ?? null, answer: a.answer, evaluation: a.evaluation,
    assessmentReward: a.assessmentReward ?? a.evaluation?.assessmentReward,
    sources: sourceViewsForAttempt(a), previousState: a.previousState, createdAt: a.createdAt,
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
  kind: AttemptKind; outcome: AttemptOutcome; parentAttemptId: string | null; rootAttemptId: string; learningSpecRevision?: number | null; createdAt: number;
};
export function getAttempt(id: string): AttemptView {
  const a = attempt(id);
  if (!a.evaluation) throw new NotFoundError(`attempt ${id} has no evaluation`);
  const c = conceptFor(a.courseId, a.conceptId);
  const spec = specForAttempt(a);
  return {
    id: a.id, courseId: a.courseId, conceptId: c.id, conceptName: c.name, question: spec.assessment.question, state: c.state,
    answer: a.answer, attachment: a.imageName ?? null, evaluation: a.evaluation,
    kind: a.kind, outcome: a.outcome, parentAttemptId: a.parentAttemptId, rootAttemptId: a.rootAttemptId,
    learningSpecRevision: a.learningSpecRevision ?? spec.revision, createdAt: a.createdAt,
  };
}

export function clarify(attemptId: string) {
  const a = attempt(attemptId);
  if (!a.evaluation) throw new NotFoundError(`attempt ${attemptId} has no evaluation to clarify`);
  if (rootHasPassedTransfer(a.rootAttemptId)) throw new InvalidAttemptLinkError("learning episode is already complete");
  if (!rootIsCurrentForConcept(a.conceptId, a.rootAttemptId, a.courseId) || latestEvaluatedInRoot(a.rootAttemptId)?.id !== a.id) {
    throw new InvalidAttemptLinkError("clarification source is stale");
  }
  return { courseId: a.courseId, conceptId: a.conceptId, followUp: clarificationPromptFor(a) };
}

// ---- remediate / transfer ----

export type RemediationView = {
  attemptId: string; courseId: string; conceptId: string; conceptName: string; state: MasteryState;
  lesson: { title: string; said: string; actuallyTrue: string; explanation: string; rule: string | null; aiWording: boolean; figure: "ci-intervals" | null; sources: LearningSourceView[] };
  transfer: { question: string; hint: string; sources: LearningSourceView[] };
};
export function getRemediation(attemptId: string): RemediationView {
  const a = attempt(attemptId);
  const c = conceptFor(a.courseId, a.conceptId);
  const spec = specForAttempt(a);
  if (a.evaluation?.verdict !== "incorrect" || !a.evaluation.misconceptionId) {
    throw new NotFoundError(`nothing to remediate for ${attemptId}`);
  }
  const remediation = spec.remediations.find((r) => r.misconceptionId === a.evaluation!.misconceptionId);
  if (!remediation) throw new NotFoundError(`nothing to remediate for ${attemptId}`);
  return {
    attemptId, courseId: a.courseId, conceptId: c.id, conceptName: c.name, state: c.state,
    lesson: {
      title: remediation.title,
      said: a.evaluation.evidenceQuote ?? a.answer,
      actuallyTrue: remediation.actuallyTrue,
      explanation: remediation.explanation,
      rule: remediation.sourceLabel,
      aiWording: spec.provenance.kind === "generated",
      figure: remediation.figure,
      sources: learningSourceViews(spec, remediation.sourceIds),
    },
    transfer: { question: spec.transfer.question, hint: spec.transfer.hint, sources: learningSourceViews(spec, spec.transfer.sourceIds) },
  };
}

export type TransferChallengeView = {
  attemptId: string; courseId: string; conceptId: string; conceptName: string; state: MasteryState;
  transfer: { question: string; hint: string; sources: LearningSourceView[] };
};

export function getTransferChallenge(attemptId: string): TransferChallengeView {
  const source = attempt(attemptId);
  const c = conceptFor(source.courseId, source.conceptId);
  const spec = specForAttempt(source);
  if (source.evaluation?.verdict !== "correct") throw new NotFoundError(`no direct transfer challenge for ${attemptId}`);
  if (
    !rootIsCurrentForConcept(c.id, source.rootAttemptId, source.courseId) ||
    latestConclusiveForConcept(c.id, source.courseId)?.id !== source.id
  ) {
    throw new NotFoundError(`stale transfer challenge ${attemptId}`);
  }
  if (rootHasPassedTransfer(source.rootAttemptId)) {
    throw new NotFoundError(`transfer already passed for ${attemptId}`);
  }
  return {
    attemptId: source.id, courseId: source.courseId, conceptId: c.id, conceptName: c.name, state: c.state,
    transfer: { question: spec.transfer.question, hint: spec.transfer.hint, sources: learningSourceViews(spec, spec.transfer.sourceIds) },
  };
}

export async function submitTransfer(attemptId: string, answer: string): Promise<TransferResult> {
  const parent = attempt(attemptId);
  const c = conceptFor(parent.courseId, parent.conceptId);
  const spec = specForAttempt(parent);
  if (
    !rootIsCurrentForConcept(c.id, parent.rootAttemptId, parent.courseId) ||
    latestConclusiveForConcept(c.id, parent.courseId)?.id !== parent.id
  ) {
    throw new InvalidAttemptLinkError("transfer source is stale");
  }
  if (rootHasPassedTransfer(parent.rootAttemptId)) {
    throw new InvalidAttemptLinkError("this evidence chain already passed its transfer test");
  }
  const before = c.state;
  const judged = await judgeTransferForSpec(spec, answer);
  if (
    conceptFor(parent.courseId, parent.conceptId) !== c ||
    !rootIsCurrentForConcept(c.id, parent.rootAttemptId, parent.courseId) ||
    latestConclusiveForConcept(c.id, parent.courseId)?.id !== parent.id
  ) {
    throw new InvalidAttemptLinkError("transfer source became stale");
  }
  if (db().attempts.some((a) => a.rootAttemptId === parent.rootAttemptId && a.kind === "transfer" && a.outcome === "pass")) {
    throw new InvalidAttemptLinkError("this evidence chain already passed its transfer test");
  }

  c.evidence.answers++;
  if (judged.verdict === "pass") {
    c.evidence.sound++;
    c.evidence.transferPassed = true;
    upsertSkill(c, spec.skills.onRight);
    upsertSkill(c, { label: "New-question test", pct: 85 });
    c.state = "provisional";
    c.nextReview = isoDay(addDays(new Date(), 1));
    db().provenDays.add(isoDay(new Date()));
    const rec = recordAttempt({
      courseId: parent.courseId, conceptId: c.id, kind: "transfer", outcome: "pass", parentAttemptId: parent.id,
      learningSpecRevision: spec.revision,
      assessmentReward: { score: judged.score ?? null, level: null, pointsGained: 0 },
      answer, evaluation: null, previousState: before, createdAt: Date.now(),
    });
    return { result: "pass", resultAttemptId: rec.id };
  }

  const diagnosed = misconceptionForSpec(spec, judged.misconceptionId);
  let evaluation: Evaluation;
  let followUp: string | null = null;
  if (judged.verdict === "fail" && diagnosed) {
    upsertSkill(c, spec.skills.onWrong);
    upsertSkill(c, { label: "New-question test", pct: 25 });
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    evaluation = {
      verdict: "incorrect", errorType: "conceptual", misconceptionId: diagnosed.id, misconceptionName: diagnosed.name,
      evidenceQuote: judged.quote && answer.includes(judged.quote) ? judged.quote : null, gapSentence: diagnosed.description,
      skills: (c.skills ?? []).filter((skill) => skill.label !== "New-question test"),
      votes: judged.votes, followUp: null,
      recommendation: "The new setup exposed the same underlying gap. Repair that idea, then prove it again on another setup.",
    };
  } else {
    followUp = judged.feedback ?? "Give one more precise sentence that addresses every part of the question.";
    evaluation = {
      verdict: "uncertain", errorType: "uncertain", misconceptionId: null, misconceptionName: null,
      evidenceQuote: null, gapSentence: null,
      skills: (c.skills ?? []).filter((skill) => skill.label !== "New-question test"),
      votes: judged.votes, followUp, recommendation: "There is not enough evidence to name a misconception yet.",
    };
  }
  const rec = recordAttempt({
    courseId: parent.courseId, conceptId: c.id, kind: "transfer", outcome: "fail", parentAttemptId: parent.id,
    learningSpecRevision: spec.revision,
    assessmentReward: { score: judged.score ?? null, level: null, pointsGained: 0 },
    answer, evaluation, previousState: before, createdAt: Date.now(),
  });
  return { result: "fail", failedAttemptId: rec.id, nextAttemptId: evaluation.verdict === "incorrect" ? rec.id : null, followUp };
}

export type ResultView = {
  assessmentReward?: AssessmentReward;
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
  const c = conceptFor(a.courseId, a.conceptId);
  const course = courseFor(a.courseId);
  const { attempts } = db();
  const diagnoses = attempts.filter((x) => x.rootAttemptId === a.rootAttemptId && x.evaluation?.verdict === "incorrect");
  const confirmed = confirmedIncorrectForRoot(a.rootAttemptId);
  const hadOverturnedDiagnosis = diagnoses.length > 0 && !confirmed;
  const diagnosed = confirmed?.evaluation?.misconceptionName ?? null;
  const earlierMisses = transferMissesFor(a.rootAttemptId, a.createdAt);
  const nxt = nextConceptFor(course);
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const prov = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    assessmentReward: a.assessmentReward,
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: "provisional",
    diagnosisLabel: diagnosed ? "Misconception found" : "Diagnosis",
    misconception: diagnosed ?? (hadOverturnedDiagnosis ? "Not confirmed after clarification" : "None detected"),
    intervention: diagnosed ? "1 short lesson" : hadOverturnedDiagnosis ? "Clarified the diagnosis" : "No remediation needed",
    transferText: earlierMisses === 0 ? "Correct on first try" : `Correct after ${earlierMisses} earlier ${earlierMisses === 1 ? "miss" : "misses"}`,
    nextReview: c.nextReview ? `${c.nextReview === isoDay(addDays(new Date(), 1)) ? "Tomorrow, " : ""}${shortDate(new Date(`${c.nextReview}T00:00:00`))}` : "Not scheduled",
    recommendation: nxt ? `${nxt.name} is next. You're one new question away from proving it.` : "You've covered every concept currently available in this course.",
    nextConcept: nxt ? { name: nxt.name, href: practiceHrefFor(course.id, nxt) } : null,
    segments: [...course.concepts].map((x) => x.state).sort((p, q) => RANK.indexOf(p) - RANK.indexOf(q)),
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} proven + ${prov} provisional`,
    points: rewardsForCourse(course).awards.filter(x => x.evidenceId === a.id).map(x => ({ label: x.category === "bonus" ? "Course mastery bonus" : "Explanation assessment mastery", points: x.points })),
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
  const concepts = course.concepts.flatMap((c) => {
    const status = cardStatus(c.state);
    return status ? [{ name: c.name, mastery: masteryOf(c), status }] : [];
  });
  const count = (status: string) => concepts.filter((c) => c.status === status).length;
  const next = nextConceptFor(course);
  const facts = course.concepts
    .filter((c) => c.state === "needs_work" || c.state === "developing")
    .map((c) => {
      const last = latestConfirmedIncorrect(c.id, course.id);
      return {
        concept: c.name,
        misconception: last?.evaluation?.misconceptionName
          ?? (c.state === "needs_work" ? primaryMisconceptionFor(course.id, c.id)?.name ?? null : null),
        quote: last?.evaluation?.evidenceQuote ?? null,
      };
    });
  return {
    attemptCount: course.concepts.reduce((n, c) => n + c.evidence.answers, 0),
    headline: `${count("mastered")} mastered, ${count("transfer-pending")} awaiting a transfer test, ${count("reteaching")} to reteach`,
    concepts,
    riskConcept: course.concepts.find((c) => c.state === "needs_work")?.name ?? null,
    riskName: course.concepts.find((c) => c.state === "needs_work")?.name ?? null,
    nextHref: next ? practiceHrefFor(course.id, next) : null,
    facts,
    fallback: {
      misconceptions: facts.map((fact) => ({ concept: fact.concept, misconception: fact.misconception })),
      biggestRisk: { reason: facts[0]?.misconception ? `Open misconception: ${facts[0].misconception}.` : "No open misconceptions right now." },
      recommendation: isCompleted(course)
        ? "This course is complete. Come back for reviews when they are due."
        : next
          ? `Work on ${next.name} next.`
          : "Nothing else is ready to test in this course.",
      nextActions: next ? [`Test ${next.name}`] : [],
    },
  };
}

// ---- review queue, history, misconception log, files ----

export type ReviewItem = { id: string; name: string; courseName: string; when: string; /** ISO day the review lands. */ day: string; due: boolean; href: string | null };
export function getReviews(now = new Date()): { due: ReviewItem[]; upcoming: ReviewItem[] } {
  const today = isoDay(now);
  const items = allCourses().flatMap((course) =>
    course.concepts
      .filter((c) => c.nextReview && (c.state === "provisional" || c.state === "mastered"))
      .map((c) => {
        const due = c.nextReview! <= today;
        return {
          id: c.id, name: c.name, courseName: course.name, day: c.nextReview!, due,
          href: due && testableIn(course.id, c) ? `/course/${course.id}/review/${c.id}` : null,
          when: due ? "Due now" : shortDate(new Date(`${c.nextReview}T00:00:00`)),
        };
      })
  );
  return { due: items.filter((item) => item.due), upcoming: items.filter((item) => !item.due) };
}

export type ReviewChallengeView = {
  courseId: string; conceptId: string; conceptName: string; state: MasteryState; dueDay: string;
  learningSpecRevision?: number;
  review: { question: string; hint: string; sources: LearningSourceView[] };
};

const reviewIsDue = (c: Concept, now: Date) =>
  !!c.nextReview && (c.state === "provisional" || c.state === "mastered") && c.nextReview <= isoDay(now);

const reviewSpecFor = (courseId: string, conceptId: string, revision?: number): ConceptLearningSpec => {
  if (revision !== undefined) return specFor(courseId, conceptId, revision);
  const proof = [...db().attempts].reverse().find((a) =>
    a.courseId === courseId &&
    a.conceptId === conceptId &&
    a.kind === "transfer" &&
    a.outcome === "pass"
  );
  return specFor(courseId, conceptId, proof?.learningSpecRevision);
};

export function getReviewChallenge(courseId: string, conceptId: string, now = new Date()): ReviewChallengeView {
  const c = conceptFor(courseId, conceptId);
  const spec = reviewSpecFor(courseId, conceptId);
  if (!reviewIsDue(c, now)) throw new NotFoundError(`no due review for ${conceptId}`);
  return {
    courseId, conceptId: c.id, conceptName: c.name, state: c.state, dueDay: c.nextReview!,
    learningSpecRevision: spec.revision,
    review: { question: spec.review.question, hint: spec.review.hint, sources: learningSourceViews(spec, spec.review.sourceIds) },
  };
}

export async function submitReview(
  courseId: string,
  conceptId: string,
  answer: string,
  now = new Date(),
  learningSpecRevision?: number,
): Promise<ReviewSubmitResult> {
  const c = conceptFor(courseId, conceptId);
  const spec = reviewSpecFor(courseId, conceptId, learningSpecRevision);
  if (!reviewIsDue(c, now)) throw new ReviewNotDueError("That review isn't due yet.");
  const previousState = c.state;
  const expectedDay = c.nextReview;
  const expectedLatestAttempt = latestAttemptForConcept(c.id, courseId)?.id ?? null;
  const judged = await judgeReviewForSpec(spec, answer);
  if (
    conceptFor(courseId, conceptId) !== c ||
    c.state !== previousState ||
    c.nextReview !== expectedDay ||
    (latestAttemptForConcept(c.id, courseId)?.id ?? null) !== expectedLatestAttempt
  ) {
    throw new InvalidAttemptLinkError("review state changed while evaluating");
  }

  c.evidence.answers++;
  if (judged.verdict === "pass") {
    c.evidence.sound++;
    c.evidence.transferPassed = true;
    upsertSkill(c, spec.skills.onRight);
    upsertSkill(c, { label: "Retention", pct: 90 });
    c.state = "mastered";
    c.nextReview = isoDay(addDays(now, reviewGapDays(c.id, courseId)));
    db().provenDays.add(isoDay(now));
    const rec = recordAttempt({
      courseId, conceptId: c.id, kind: "review", outcome: "pass",
      learningSpecRevision: spec.revision,
      assessmentReward: { score: judged.score ?? null, level: null, pointsGained: 0 },
      answer, evaluation: null, previousState, createdAt: now.getTime(),
    });
    return { result: "pass", resultAttemptId: rec.id };
  }

  const diagnosed = misconceptionForSpec(spec, judged.misconceptionId);
  if (judged.verdict === "fail" && diagnosed) {
    upsertSkill(c, spec.skills.onWrong);
    upsertSkill(c, { label: "Retention", pct: 25 });
    c.state = "needs_work";
    c.evidence.transferPassed = false;
    c.nextReview = null;
    const evaluation: Evaluation = {
      verdict: "incorrect", errorType: "conceptual", misconceptionId: diagnosed.id, misconceptionName: diagnosed.name,
      evidenceQuote: judged.quote && answer.includes(judged.quote) ? judged.quote : null, gapSentence: diagnosed.description,
      skills: c.skills ?? [], votes: judged.votes, followUp: null,
      recommendation: "The delayed check exposed the gap again. Repair it, then prove it on a fresh transfer question.",
    };
    const rec = recordAttempt({
      courseId, conceptId: c.id, kind: "review", outcome: "fail",
      learningSpecRevision: spec.revision,
      assessmentReward: { score: judged.score ?? null, level: null, pointsGained: 0 },
    answer, evaluation, previousState, createdAt: now.getTime(),
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
    courseId, conceptId: c.id, kind: "review", outcome: "uncertain",
    learningSpecRevision: spec.revision,
    assessmentReward: { score: judged.score ?? null, level: null, pointsGained: 0 },
    answer, evaluation, previousState, createdAt: now.getTime(),
  });
  return { result: "uncertain", attemptId: rec.id, followUp };
}

export type ReviewResultView = {
  assessmentReward?: AssessmentReward;
  courseId: string; courseName: string; conceptName: string; previous: MasteryState; next: "mastered";
  nextReview: string; pointsEarned: number; coursePct: number; provenLabel: string;
};

export function getReviewResult(attemptId: string): ReviewResultView {
  const a = attempt(attemptId);
  if (a.kind !== "review" || a.outcome !== "pass") throw new NotFoundError(`no review result for ${attemptId}`);
  const c = conceptFor(a.courseId, a.conceptId);
  const course = courseFor(a.courseId);
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const provisional = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    assessmentReward: a.assessmentReward,
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: "mastered",
    nextReview: c.nextReview ? shortDate(new Date(`${c.nextReview}T00:00:00`)) : "Not scheduled",
    pointsEarned: rewardsForCourse(course).awards.filter(x => x.evidenceId === a.id).reduce((n, x) => n + x.points, 0),
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} mastered${provisional ? ` + ${provisional} provisional` : ""}`,
  };
}

export type HistoryEvent = { id: string; at: number; title: string; detail: string; tone: "good" | "warn" | "bad"; href: string; /** Set for a quiz. Every other event is an attempt with its own evidence record. */ quizPct?: number };
export function getHistory(): HistoryEvent[] {
  const { attempts } = db();
  const quizEvents: HistoryEvent[] = (db().quizzes ?? []).filter((q) => hasCourse(q.courseId)).map((q) => {
    const right = q.items.filter((it) => it.picked === it.correct);
    const rightIds = new Set(right.map((it) => it.conceptId));
    const weak = [...new Set(q.items.filter((it) => !rightIds.has(it.conceptId)).map((it) => it.concept))];
    const strong = [...new Set(right.map((it) => it.concept))];
    const list = (names: string[]) => `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` and ${names.length - 2} more` : ""}`;
    const detail = [strong.length ? `Right on ${list(strong)}.` : "", weak.length ? `Weak on ${list(weak)}.` : ""].filter(Boolean).join(" ");
    return { id: q.id, at: q.at, title: `Quiz on ${q.courseName}: ${q.score} of ${q.total}`, detail: detail || "Review your answers", tone: q.pct >= 70 ? "good" as const : q.pct >= 40 ? "warn" as const : "bad" as const, href: `/course/${q.courseId}/quiz/${q.id}`, quizPct: q.pct };
  });
  const fromAttempts = [...attempts].reverse().map((a) => {
    const c = conceptFor(a.courseId, a.conceptId);
    const base = `/course/${a.courseId}`;
    if (a.kind === "quiz" && a.outcome === "correct") return { id: a.id, at: a.createdAt, title: `Quiz check on ${c.name}`, detail: "Correct multiple-choice signal · mastery not proved", tone: "good" as const, href: `${base}/practice/${c.id}` };
    if (a.kind === "quiz" && a.outcome === "incorrect") return { id: a.id, at: a.createdAt, title: `Quiz check on ${c.name}`, detail: "Missed multiple-choice signal · no misconception inferred", tone: "warn" as const, href: `${base}/practice/${c.id}` };
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
  // Attempt events keep their own order. Each quiz goes in before the first event that is not newer than it.
  const out = [...fromAttempts];
  for (const q of [...quizEvents].sort((a, b) => b.at - a.at)) {
    const i = out.findIndex((e) => e.at <= q.at);
    out.splice(i < 0 ? out.length : i, 0, q);
  }
  return out;
}

export type MisconceptionEntry = { key: string; name: string; concept: string; quote: string | null; /** What the misconception gets wrong, in one sentence. */ gap: string; open: boolean; note: string; href: string };
export function getMisconceptionLog(courseId: string): MisconceptionEntry[] {
  const course = courseFor(courseId);
  const { attempts } = db();
  return course.concepts.flatMap((c) => {
    const spec = getLearningSpec(courseId, c.id);
    if (!spec) return [];
    return spec.misconceptions.flatMap((m, index) => {
      const last = [...attempts].reverse().find((a) =>
        a.courseId === courseId &&
        a.conceptId === c.id &&
        a.evaluation?.verdict === "incorrect" &&
        a.evaluation.misconceptionId === m.id &&
        !diagnosisOverturned(a)
      );
      const seededOpen =
        c.state === "needs_work" &&
        index === 0 &&
        !attempts.some((a) => a.courseId === courseId && a.conceptId === c.id && a.evaluation?.verdict === "incorrect");
      if (!last && !seededOpen) return [];
      const repaired = c.evidence.transferPassed && c.state !== "needs_work";
      return [{
        key: `${courseId}:${c.id}:${m.id}`,
        name: m.name,
        concept: c.name,
        gap: m.description,
        quote: last?.evaluation?.evidenceQuote ?? null,
        open: !repaired,
        note: repaired ? "Fixed with a lesson and a new question" : last ? "Open until you pass a new question" : "From your earlier attempts",
        href: last && !repaired ? `/course/${courseId}/lesson/${last.id}` : practiceHrefFor(courseId, c),
      }];
    });
  });
}

export type CourseFile = { name: string; kind: string; detail: string };
export function getFiles(courseId: string): { courseName: string; files: CourseFile[] } {
  const course = courseFor(courseId);
  return { courseName: course.name, files: course.files };
}

// ---- course upload ----

/** The map is a 4-column by 3-row canvas (480 by 336), so an uploaded course is trimmed to fit it. */
export const MAX_UNITS = 4;
export const MAX_PER_UNIT = 3;
const ROWS = [72, 165, 258];

export class EmptyOutlineError extends Error {}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Turns an extracted outline into a viewable course. Every concept starts not_started, so a new course adds no rank points.
 * Prerequisites are kept only when both ends exist and `from` sits in the same or an earlier unit, which is also what the graph can draw.
 */
export function createCourse(input: { name: string; outline: CourseOutline; files: CourseFile[]; rewardSource?: string }): string {
  const units = input.outline.units
    .map((u) => ({ name: u.name.trim(), concepts: u.concepts.filter((c) => c.name.trim()).slice(0, MAX_PER_UNIT) }))
    .filter((u) => u.name && u.concepts.length > 0)
    .slice(0, MAX_UNITS);
  if (units.length === 0) throw new EmptyOutlineError("No concepts found in those files.");

  const { course, samples } = db();
  const taken = new Set([course, ...samples].map((c) => c.id));
  const base = slug(input.name) || "course";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  const concepts: Concept[] = [];
  const unitOf = new Map<string, number>();
  const byName = new Map<string, string>();
  units.forEach((u, ui) => {
    const unit = `${String(ui + 1).padStart(2, "0")} ${clip(u.name, 24).toUpperCase()}`;
    u.concepts.forEach((c, row) => {
      const cid = `${id}-${concepts.length + 1}`;
      const name = clip(c.name.trim(), 48);
      concepts.push({
        id: cid, name, importance: c.importance, short: clip(c.short.trim() || name.split(/\s+/).slice(0, 2).join(" "), 16), unit, desc: clip(c.desc.trim(), 160),
        x: Math.round((480 / units.length) * (ui + 0.5)), y: ROWS[row]!,
        state: "not_started", skills: null, evidence: app(0, 0), nextReview: null,
      });
      unitOf.set(cid, ui);
      if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), cid);
    });
  });

  const edges: [string, string][] = [];
  for (const p of input.outline.prerequisites) {
    const from = byName.get(clip(p.from.trim(), 48).toLowerCase()), to = byName.get(clip(p.to.trim(), 48).toLowerCase());
    if (!from || !to || from === to || unitOf.get(from)! > unitOf.get(to)!) continue;
    if (!edges.some(([a, b]) => a === from && b === to)) edges.push([from, to]);
  }

  samples.push({ rewardIdentity: input.rewardSource ? rewardFingerprint(input.rewardSource) : undefined, id, name: clip(input.name.trim(), 60), deadline: "No quiz date set", examDate: null, concepts, edges, files: input.files, completedOverride: null, runtime: true });
  rewardsForCourse(courseFor(id));
  persistLearning();
  return id;
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
    const last = bad && (latestConfirmedIncorrect(bad.id, c.id)?.evaluation?.misconceptionName ?? primaryMisconceptionFor(c.id, bad.id)?.name ?? null);
    return {
      id: c.id, name: c.name, pct: coursePct(c.concepts),
      proven: c.concepts.filter((x) => x.state === "mastered").length, total: c.concepts.length,
      needsWork: c.concepts.filter((x) => x.state === "needs_work").length,
      inProgress: c.concepts.filter((x) => x.state === "developing" || x.state === "provisional").length,
      notStarted: c.concepts.filter((x) => x.state === "not_started").length,
      next: nextConceptFor(c)?.name ?? c.concepts.find((x) => x.state !== "mastered")?.name ?? null,
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

function tasksFor(c: Course): Task[] {
  const today = isoDay(new Date());
  return c.concepts.flatMap((x): Task[] => {
    const provedByWork = x.state === "provisional" || x.state === "mastered";
    const href = canPractice(c, x) ? practiceHrefFor(c.id, x) : null;
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
  return [course, ...samples]
    .filter((c) => !isCompleted(c) && (!c.runtime || c.concepts.some((concept) => canPractice(c, concept))))
    .map((c) => {
    const all = tasksFor(c);
    const open = all.filter((t) => !t.done).sort((a, b) => taskRank(a) - taskRank(b));
    return { courseId: c.id, courseName: c.name, open, done: all.filter((t) => t.done), total: all.length, doneCount: all.filter((t) => t.done).length };
  });
}

/** Ticks or unticks a task by hand. Progress-based completion can't be undone, and a hand tick never changes mastery. */
export function setTaskDone(id: string, done: boolean): void {
  const { course, samples } = db();
  const task = [course, ...samples].flatMap((c) => tasksFor(c)).find((t) => t.id === id);
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
      out.push({ id: `review:${x.id}`, title: `Review ${x.name}`, start: new Date(`${x.nextReview}T00:00:00`).toISOString(), end: new Date(`${x.nextReview}T23:59:59`).toISOString(), allDay: true, kind: "review", href: `/course/${c.id}/review/${x.id}` });
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
/**
 * Points for one course, or for every course when `courseId` is left out. The overall rank is not the sum of
 * the course ranks, because the streak counts once, for the student, and not per course.
 */
/** Plans and awards survive course deletion and are shared by duplicate imports of the same source. */
function rewardsForCourse(course: Course) {
  const ledger = db().rewardLedger ??= emptyRewardLedger();
  const identity = course.rewardIdentity ??= rewardFingerprint(course.concepts.map(c => rewardName(c.name)).sort().join("|"));
  return ledger.courses[identity] ??= makeCourseRewards(course.concepts.map(c => ({
    name: c.name,
    importance: c.importance ?? (course.edges.filter(([from]) => from === c.id).length >= 2 ? 3 : 2),
  })));
}

function checkCourseBonus(course: Course, evidenceId: string): number {
  return awardCourseBonus(rewardsForCourse(course), course.concepts.length > 0 && course.concepts.every(c => c.state === "mastered"), evidenceId);
}

export function getRewards(courseId?: string): Rewards {
  const data = db();
  data.peakByCourse ??= {};
  const course = courseId ? courseFor(courseId) : null;
  const plan = course ? rewardsForCourse(course) : null;
  if (!course) for (const c of [data.course, ...data.samples]) rewardsForCourse(c);
  const plans = plan ? [plan] : Object.values(data.rewardLedger!.courses);
  const awards = plans.flatMap(p => p.awards);
  const rows = (["quiz", "explanation", "bonus"] as const).map(category => ({
    label: category === "quiz" ? "Quiz assessment mastery" : category === "explanation" ? "Explanation assessment mastery" : "Course mastery bonuses",
    count: awards.filter(a => a.category === category).length, each: 0,
    points: awards.filter(a => a.category === category).reduce((n, a) => n + a.points, 0),
  }));
  const earned = rows.reduce((n, r) => n + r.points, 0);
  // Preserve the previous displayed total as a floor, not a new source of recurring points.
  const previous = courseId ? data.peakByCourse[courseId] ?? 0 : data.peakPoints;
  const points = Math.max(previous, earned);
  if (previous > earned) rows.push({ label: "Previously earned points retained", count: 1, each: previous - earned, points: previous - earned });
  if (courseId) data.peakByCourse[courseId] = points; else data.peakPoints = points;
  persistLearning();
  const tiers = plan ? courseTiers(Object.keys(plan.topics).length) : TIERS;
  const standingNow = standing(points, tiers);
  return { ...standingNow, breakdown: rows, ladder: tiers.map((t, i) => ({ ...t, reached: i <= standingNow.tierIndex, current: i === standingNow.tierIndex })) };
}

// ---- quiz evidence ----

export type QuizItemRecord = { learningSpecRevision?: number; sources?: LearningSourceView[]; format?: "quiz" | "explanation"; marks?: number; earnedMarks?: number; explanationScore?: number | null; response?: string; conceptId: string; concept: string; prompt: string; options: string[]; picked: number | null; correct: number; explanation: string };
export type QuizChange = { conceptId: string; concept: string; from: MasteryState; to: MasteryState };
export type QuizRecord = { id: string; courseId: string; courseName: string; at: number; score: number; total: number; pct: number; items: QuizItemRecord[]; changes: QuizChange[]; pointsGained: number };

const quizList = () => (db().quizzes ??= []);
const hasCourse = (id: string) => db().course.id === id || db().samples.some((c) => c.id === id);

/** Concepts answered right at least once in any quiz, for one course or all of them. Each counts once, so retaking a quiz earns nothing new. */
export function quizConceptsRight(courseId?: string): number {
  const found = new Set<string>();
  for (const q of quizList()) {
    if ((courseId && q.courseId !== courseId) || !hasCourse(q.courseId)) continue;
    for (const it of q.items) if (it.picked === it.correct) found.add(`${q.courseId}:${it.conceptId}`);
  }
  return found.size;
}

/** Quiz answers may start an unseen concept; diagnosis, demotion, transfer and mastery require stronger evidence. */
export function stateAfterQuiz(state: MasteryState, _right: number, answered: number): MasteryState {
  return answered > 0 && state === "not_started" ? "developing" : state;
}

/** Saves a finished quiz and moves each concept it covered. Called once per quiz. */
export function recordQuiz(input: { courseId: string; items: QuizItemRecord[] }): QuizRecord {
  const course = courseFor(input.courseId);
  // Only questions that were answered count as evidence. A blank says nothing about the concept.
  const per = new Map<string, { right: number; answered: number }>();
  for (const it of input.items) {
    if (it.picked === null) continue;
    const t = per.get(it.conceptId) ?? { right: 0, answered: 0 };
    t.answered++;
    if (it.picked === it.correct) t.right++;
    per.set(it.conceptId, t);
  }
  const changes: QuizChange[] = [];
  for (const [conceptId, t] of per) {
    const c = course.concepts.find((x) => x.id === conceptId);
    if (!c) continue;
    const to = stateAfterQuiz(c.state, t.right, t.answered);
    upsertSkill(c, { label: "Quiz", pct: Math.round((t.right / t.answered) * 100) });
    if (to !== c.state) changes.push({ conceptId, concept: c.name, from: c.state, to });
  }
  const score = input.items.reduce((n, it) => n + (it.earnedMarks ?? (it.picked === it.correct ? 1 : 0)), 0);
  const total = input.items.reduce((n, it) => n + (it.marks ?? 1), 0);
  const record: QuizRecord = {
    id: `q${++db().seq}`, courseId: course.id, courseName: course.name, at: Date.now(), score, total,
    pct: total ? Math.floor((score / total) * 1000) / 10 : 0, items: input.items, changes, pointsGained: 0,
  };
  recordQuizEvidence(input.courseId, input.items.flatMap((it) => it.picked === null ? [] : [{
    conceptId: it.conceptId, prompt: it.prompt, selected: it.response ?? it.options[it.picked] ?? "", correct: it.picked === it.correct,
  }]), record.at);
  const plan = rewardsForCourse(course);
  const percentage = record.total ? 100 * record.score / record.total : 0;
  for (const c of course.concepts) {
    const items = input.items.filter(it => it.conceptId === c.id);
    const choices = items.filter(it => it.format !== "explanation");
    if (choices.length) {
      const coverage = choices.filter(it => it.picked === it.correct).map(it => it.prompt);
      record.pointsGained += awardAssessment(plan, c.name, "quiz", percentage, coverage, record.id).pointsGained;
    }
    const explanations = items.filter(it => it.format === "explanation");
    if (explanations.length) {
      // An overall pass cannot launder an unsupported or incorrect explanation into full topic credit.
      const supportedScore = Math.min(percentage, Math.max(...explanations.map(it => it.explanationScore ?? 0)));
      record.pointsGained += awardAssessment(plan, c.name, "explanation", supportedScore, 1, record.id).pointsGained;
    }
  }
  record.pointsGained += checkCourseBonus(course, record.id);
  quizList().push(record);
  persistLearning();
  return record;
}

export function getQuizRecord(id: string): QuizRecord {
  const q = quizList().find((x) => x.id === id);
  if (!q || !hasCourse(q.courseId)) throw new NotFoundError(`quiz ${id}`);
  return q;
}

export const listQuizRecords = (courseId?: string): QuizRecord[] => quizList().filter((q) => hasCourse(q.courseId) && (!courseId || q.courseId === courseId)).sort((a, b) => b.at - a.at);

export type CourseRank = { courseId: string; name: string } & Standing;
/** Each course's own rank, using the same tiers. */
export function getCourseRanks(): CourseRank[] {
  const { course, samples } = db();
  return [course, ...samples].map((c) => {
    const { points, tierIndex, tier, next, toNext, pct } = getRewards(c.id);
    return { courseId: c.id, name: c.name, points, tierIndex, tier, next, toNext, pct };
  });
}

