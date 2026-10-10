import "server-only";
import { cardStatus, type AssessInput, type AssessResult, type AttemptKind, type AttemptOutcome, type Evaluation, type MasteryState, type ReviewText, type TransferResult } from "@proveit/lib/schemas";
import { toneForPct, type Tone } from "@proveit/lib/mastery";
import { AUTHORED } from "./content";
import { judgeAnswer, judgeTransfer, type AnswerContext } from "./evaluator";
import type { CalEvent } from "./calendar";
import { POINTS, STREAK_CAP, standing, TIERS, type Standing } from "@proveit/lib/rewards";

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
      completedOverride: null,
      examDate: "2026-10-15",
      files: [{ name: "OpenStax Introductory Statistics 2e", kind: "Textbook, CC BY 4.0", detail: "Source for all 12 concepts and the misconceptions they carry." }],
      edges: [["pop", "par"], ["par", "se"], ["var", "se"], ["var", "par"], ["se", "moe"], ["size", "moe"], ["clt", "cic"], ["moe", "cic"], ["cic", "cii"], ["cic", "pv"], ["nul", "pv"], ["pv", "err"]],
    },
    samples: [sampleLinearAlgebra(), samplePersonalFinance()],
    attempts: [],
    provenDays: new Set(),
    taskDone: new Set(),
    peakPoints: 0,
    seq: 0,
  };
}

/** Sample courses so the sidebar, Courses page and dashboard have more than one course. They can be opened but not practiced. */
type SampleSpec = [id: string, name: string, short: string, unit: string, desc: string, state: MasteryState];
function sampleCourse(id: string, name: string, deadline: string, examDate: string | null, units: string[], spec: SampleSpec[], file: CourseFile): Course {
  const concepts = spec.map(([cid, cname, short, unit, desc, state], i): Concept => ({
    id: cid, name: cname, short, unit, desc, state, x: 60 + 120 * units.indexOf(unit), y: i % 2 === 0 ? 72 : 165,
    skills: state === "mastered" ? M : state === "developing" || state === "provisional" ? D : null,
    evidence: state === "mastered" ? app(3, 3, true) : state === "not_started" ? app(0, 0) : app(1, 1), nextReview: null,
  }));
  return { id, name, deadline, examDate, concepts, edges: concepts.slice(1).map((c, i) => [concepts[i]!.id, c.id] as [string, string]), files: [file], completedOverride: null };
}

const sampleFile = (what: string): CourseFile => ({ name: "Sample syllabus.pdf", kind: "Sample", detail: `Placeholder so ${what} has data to show.` });

const sampleLinearAlgebra = () => sampleCourse("linear-algebra", "Linear Algebra", "Completed Aug 14", null,
  ["01 VECTORS", "02 MATRICES", "03 SYSTEMS", "04 EIGEN"], [
    ["la-vec", "Vectors and span", "Vectors", "01 VECTORS", "Combine vectors and describe everything they can reach.", "mastered"],
    ["la-ind", "Linear independence", "Independence", "01 VECTORS", "Tell when a set of vectors adds no new direction.", "mastered"],
    ["la-mat", "Matrix operations", "Matrices", "02 MATRICES", "Add, scale and multiply matrices, and know when each is defined.", "mastered"],
    ["la-inv", "Inverses", "Inverses", "02 MATRICES", "Undo a matrix, and know when that is impossible.", "mastered"],
    ["la-sys", "Solving systems", "Systems", "03 SYSTEMS", "Row reduce to find every solution of a linear system.", "mastered"],
    ["la-det", "Determinants", "Determinants", "03 SYSTEMS", "Read invertibility and area scaling from one number.", "mastered"],
    ["la-eig", "Eigenvalues", "Eigenvalues", "04 EIGEN", "Find the directions a matrix only stretches.", "mastered"],
    ["la-dia", "Diagonalization", "Diagonalize", "04 EIGEN", "Rewrite a matrix in the basis of its eigenvectors.", "mastered"],
  ], sampleFile("the completed-course group"));

const samplePersonalFinance = () => sampleCourse("personal-finance", "Personal Finance 101", "Quiz Friday, Oct 23", "2026-10-23",
  ["01 BASICS", "02 CREDIT", "03 GROWTH", "04 PLANNING"], [
    ["pf-bud", "Budgeting basics", "Budgeting", "01 BASICS", "Track income and spending against a plan.", "mastered"],
    ["pf-emg", "Emergency fund", "Emergency", "01 BASICS", "Size a cash buffer and decide where to keep it.", "mastered"],
    ["pf-crs", "Credit scores", "Credit", "02 CREDIT", "What moves a score, and what a lender reads from it.", "mastered"],
    ["pf-dbt", "Debt payoff", "Debt", "02 CREDIT", "Compare avalanche and snowball payoff orders.", "developing"],
    ["pf-cmp", "Compound interest", "Compound", "03 GROWTH", "How interest on interest grows a balance over time.", "provisional"],
    ["pf-idx", "Index funds", "Index funds", "03 GROWTH", "Why low-fee broad funds beat most stock picking.", "developing"],
    ["pf-tax", "Taxes 101", "Taxes", "04 PLANNING", "Marginal rates, deductions and what a paycheck withholds.", "not_started"],
    ["pf-ret", "Retirement accounts", "Retirement", "04 PLANNING", "401(k), IRA and Roth: who gets which tax break.", "not_started"],
  ], sampleFile("an in-progress sample course"));

const g = globalThis as unknown as { __proveit?: Db };
const db = (): Db => (g.__proveit ??= seed());

// ---- helpers ----

export class NotFoundError extends Error {}
export class InvalidAttemptLinkError extends Error {}

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
    .filter((a) => a.rootAttemptId === parent.rootAttemptId && a.createdAt <= parent.createdAt && a.evaluation && a.kind !== "review")
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
  return rec;
}

const transferMissesFor = (rootAttemptId: string, beforeOrAt = Number.POSITIVE_INFINITY) =>
  db().attempts.filter((a) => a.rootAttemptId === rootAttemptId && a.kind === "transfer" && a.outcome === "fail" && a.createdAt <= beforeOrAt).length;

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

const latestConfirmedIncorrect = (conceptId: string) =>
  [...db().attempts].reverse().find((a) =>
    a.conceptId === conceptId &&
    a.evaluation?.verdict === "incorrect" &&
    !diagnosisOverturned(a),
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
  if (!testable(c)) return { label: "Not in the demo yet", href: null };
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
    concepts: course.concepts.map((c) => ({ id: c.id, name: c.name, short: c.short, unit: c.unit, desc: c.desc, x: c.x, y: c.y, state: c.state, dims: dimsFor(c), evidence: evidenceText(c), cta: active ? ctaFor(c) : { label: c.state === "mastered" ? "Mastered" : "Not in the demo yet", href: null } })),
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
    (a.kind === "initial" || a.kind === "clarification") &&
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
    recommendation: next ? `${bad ? "Fix" : "Work on"} ${next.name} next${due > 0 ? ", then clear your reviews" : ""}.` : "Nothing left to test in this demo course.",
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

  const previousState = c.state;
  const judged = input.imageSummary ? `${input.answer}\n\n[Student's attached work, transcribed] ${input.imageSummary}` : input.answer;
  const j = await judgeAnswer(c.id, judged, parent ? answerContext(parent) : undefined);
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
  if (db().attempts.some((a) => a.rootAttemptId === source.rootAttemptId && a.kind === "transfer" && a.outcome === "pass")) {
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
  if (db().attempts.some((a) => a.rootAttemptId === parent.rootAttemptId && a.kind === "transfer" && a.outcome === "pass")) {
    throw new InvalidAttemptLinkError("this evidence chain already passed its transfer test");
  }
  const before = c.state;
  const judged = await judgeTransfer(c.id, answer);
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
  const confirmed = [...diagnoses].reverse().find((x) => !diagnosisOverturned(x)) ?? null;
  const hadOverturnedDiagnosis = diagnoses.length > 0 && !confirmed;
  const diagnosed = confirmed?.evaluation?.misconceptionName ?? null;
  const earlierMisses = transferMissesFor(a.rootAttemptId, a.createdAt);
  const nxt = nextConcept();
  const proven = course.concepts.filter((x) => x.state === "mastered").length;
  const prov = course.concepts.filter((x) => x.state === "provisional").length;
  return {
    courseId: a.courseId, courseName: course.name, conceptName: c.name, previous: a.previousState, next: c.state,
    diagnosisLabel: diagnosed ? "Misconception found" : "Diagnosis",
    misconception: diagnosed ?? (hadOverturnedDiagnosis ? "Not confirmed after clarification" : "None detected"),
    intervention: diagnosed ? "1 short lesson" : hadOverturnedDiagnosis ? "Clarified the diagnosis" : "No remediation needed",
    transferText: earlierMisses === 0 ? "Correct on first try" : `Correct after ${earlierMisses} earlier ${earlierMisses === 1 ? "miss" : "misses"}`,
    nextReview: c.nextReview ? `${c.nextReview === isoDay(addDays(new Date(), 1)) ? "Tomorrow, " : ""}${shortDate(new Date(`${c.nextReview}T00:00:00`))}` : "Not scheduled",
    recommendation: nxt ? `${nxt.name} is next. You're one new question away from proving it.` : "You've covered everything in this demo course.",
    nextConcept: nxt ? { name: nxt.name, href: practiceHref(nxt) } : null,
    segments: [...course.concepts].map((x) => x.state).sort((p, q) => RANK.indexOf(p) - RANK.indexOf(q)),
    coursePct: coursePct(course.concepts),
    provenLabel: `${proven} proven + ${prov} provisional`,
    points: [
      { label: "Proved the concept", points: POINTS.proved },
      { label: "Repaired a misconception", points: POINTS.repaired },
      ...(a.failedTransfers === 0 ? [{ label: "Passed on the first try", points: POINTS.firstTry }] : []),
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
      biggestRisk: { reason: active ? d.risk?.reason ?? "No open misconceptions right now." : "No open misconceptions in this sample course." },
      recommendation: active ? d.recommendation : isCompleted(course) ? "This course is complete. Come back for reviews when they are due." : "This sample course can't be practiced in the demo yet.",
      nextActions: active ? d.nextActions.map((a) => a.label) : [],
    },
  };
}

// ---- review queue, history, misconception log, files ----

export type ReviewItem = { id: string; name: string; courseName: string; when: string; /** ISO day the review lands. */ day: string; due: boolean; href: string | null };
export function getReviews(): { due: ReviewItem[]; upcoming: ReviewItem[] } {
  const { course } = db();
  const today = isoDay(new Date());
  const items = course.concepts.filter((c) => c.nextReview && (c.state === "provisional" || c.state === "mastered")).map((c) => ({
    id: c.id, name: c.name, courseName: course.name, day: c.nextReview!, due: c.nextReview! <= today, href: testable(c) ? practiceHref(c) : null,
    when: c.nextReview! <= today ? "Due now" : shortDate(new Date(`${c.nextReview}T00:00:00`)),
  }));
  return { due: items.filter((i) => i.due), upcoming: items.filter((i) => !i.due) };
}

export type HistoryEvent = { id: string; at: number; title: string; detail: string; tone: "good" | "warn" | "bad"; href: string };
export function getHistory(): HistoryEvent[] {
  const { attempts } = db();
  return [...attempts].reverse().map((a) => {
    const c = concept(a.conceptId);
    const base = `/course/${a.courseId}`;
    if (a.kind === "transfer" && a.outcome === "pass") return { id: a.id, at: a.createdAt, title: `Passed the new question on ${c.name}`, detail: "Now provisionally mastered", tone: "good" as const, href: `${base}/result/${a.id}` };
    if (a.kind === "transfer" && a.outcome === "fail" && a.evaluation?.verdict === "incorrect") return { id: a.id, at: a.createdAt, title: `Missed the new question on ${c.name}`, detail: `Caught: ${a.evaluation.misconceptionName}`, tone: "bad" as const, href: `${base}/diagnosis/${a.id}` };
    if (a.kind === "transfer" && a.outcome === "fail") return { id: a.id, at: a.createdAt, title: `Tried the new question on ${c.name}`, detail: "Needs more evidence", tone: "warn" as const, href: `${base}/lesson/${a.parentAttemptId ?? a.rootAttemptId}` };
    const v = a.evaluation?.verdict;
    const verb = a.kind === "clarification" ? "Clarified" : "Answered";
    if (v === "incorrect") return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: `Caught: ${a.evaluation?.misconceptionName}`, tone: "bad" as const, href: `${base}/diagnosis/${a.id}` };
    if (v === "correct") return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: "No misconception found", tone: "good" as const, href: `${base}/diagnosis/${a.id}` };
    return { id: a.id, at: a.createdAt, title: `${verb} ${c.name}`, detail: "Needed one more answer", tone: "warn" as const, href: `${base}/practice/${c.id}` };
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
  const passed = attempts.filter((a) => a.kind === "transfer" && a.passed);
  const repairedConcepts = new Set(passed.map((a) => a.conceptId));
  const firstTryConcepts = new Set(passed.filter((a) => a.failedTransfers === 0).map((a) => a.conceptId));
  const rows = [
    { label: "Concepts mastered", count: concepts.filter((c) => c.state === "mastered").length, each: POINTS.mastered },
    { label: "Concepts proved with a new question", count: concepts.filter((c) => c.state === "provisional").length, each: POINTS.proved },
    { label: "Misconceptions repaired", count: repairedConcepts.size, each: POINTS.repaired },
    { label: "Passed a new question first try", count: firstTryConcepts.size, each: POINTS.firstTry },
    { label: "Courses mastered end to end", count: [course, ...samples].filter((c) => c.completedOverride === null && c.concepts.length > 0 && c.concepts.every((x) => x.state === "mastered")).length, each: POINTS.course },
    { label: "Streak days, up to 7", count: Math.min(streak(), STREAK_CAP), each: POINTS.streakDay },
  ].map((r) => ({ ...r, points: r.count * r.each }));
  const earned = rows.reduce((n, r) => n + r.points, 0);
  db().peakPoints = Math.max(db().peakPoints, earned);
  const s = standing(db().peakPoints);
  return { ...s, breakdown: rows, ladder: TIERS.map((t, i) => ({ id: t.id, name: t.name, min: t.min, reached: i <= s.tierIndex, current: i === s.tierIndex })) };
}
