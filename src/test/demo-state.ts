type MasteryState = "not_started" | "developing" | "needs_work" | "provisional" | "mastered";
type Skill = { label: string; pct: number };
type Concept = {
  id: string; name: string; short: string; unit: string; desc: string; x: number; y: number;
  state: MasteryState; skills: Skill[] | null;
  evidence: { answers: number; sound: number; transferPassed: boolean };
  nextReview: string | null;
};
type Course = {
  id: string; name: string; deadline: string; concepts: Concept[]; edges: [string, string][];
  files: { name: string; kind: string; detail: string }[]; completedOverride: boolean | null; examDate: string | null;
};

const app = (answers: number, sound: number, transferPassed = false) => ({ answers, sound, transferPassed });
const M: Skill[] = [{ label: "Application", pct: 90 }, { label: "New-question test", pct: 85 }];
const D: Skill[] = [{ label: "Application", pct: 64 }, { label: "New-question test", pct: 25 }];

type SampleSpec = [id: string, name: string, short: string, unit: string, desc: string, state: MasteryState];
function sampleCourse(id: string, name: string, deadline: string, examDate: string | null, units: string[], spec: SampleSpec[]): Course {
  const concepts = spec.map(([cid, cname, short, unit, desc, state], i): Concept => ({
    id: cid, name: cname, short, unit, desc, state, x: 60 + 120 * units.indexOf(unit), y: i % 2 === 0 ? 72 : 165,
    skills: state === "mastered" ? M : state === "developing" || state === "provisional" ? D : null,
    evidence: state === "mastered" ? app(3, 3, true) : state === "not_started" ? app(0, 0) : app(1, 1), nextReview: null,
  }));
  return {
    id, name, deadline, examDate, concepts, completedOverride: null,
    edges: concepts.slice(1).map((c, i) => [concepts[i]!.id, c.id] as [string, string]),
    files: [{ name: "Sample syllabus.pdf", kind: "Sample", detail: "Test fixture only." }],
  };
}

/** Legacy seeded state used only by unit tests that assert the old demo snapshots. */
export function demoStateForTests() {
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
      completedOverride: null, examDate: "2026-10-15",
      files: [{ name: "OpenStax Introductory Statistics 2e", kind: "Textbook, CC BY 4.0", detail: "Source for all 12 concepts and the misconceptions they carry." }],
      edges: [["pop", "par"], ["par", "se"], ["var", "se"], ["var", "par"], ["se", "moe"], ["size", "moe"], ["clt", "cic"], ["moe", "cic"], ["cic", "cii"], ["cic", "pv"], ["nul", "pv"], ["pv", "err"]] as [string, string][],
    },
    samples: [
      sampleCourse("linear-algebra", "Linear Algebra", "Completed Aug 14", null, ["01 VECTORS", "02 MATRICES", "03 SYSTEMS", "04 EIGEN"], [
        ["la-vec", "Vectors and span", "Vectors", "01 VECTORS", "Combine vectors and describe everything they can reach.", "mastered"],
        ["la-ind", "Linear independence", "Independence", "01 VECTORS", "Tell when a set of vectors adds no new direction.", "mastered"],
        ["la-mat", "Matrix operations", "Matrices", "02 MATRICES", "Add, scale and multiply matrices, and know when each is defined.", "mastered"],
        ["la-inv", "Inverses", "Inverses", "02 MATRICES", "Undo a matrix, and know when that is impossible.", "mastered"],
        ["la-sys", "Solving systems", "Systems", "03 SYSTEMS", "Row reduce to find every solution of a linear system.", "mastered"],
        ["la-det", "Determinants", "Determinants", "03 SYSTEMS", "Read invertibility and area scaling from one number.", "mastered"],
        ["la-eig", "Eigenvalues", "Eigenvalues", "04 EIGEN", "Find the directions a matrix only stretches.", "mastered"],
        ["la-dia", "Diagonalization", "Diagonalize", "04 EIGEN", "Rewrite a matrix in the basis of its eigenvectors.", "mastered"],
      ]),
      sampleCourse("personal-finance", "Personal Finance 101", "Quiz Friday, Oct 23", "2026-10-23", ["01 BASICS", "02 CREDIT", "03 GROWTH", "04 PLANNING"], [
        ["pf-bud", "Budgeting basics", "Budgeting", "01 BASICS", "Track income and spending against a plan.", "mastered"],
        ["pf-emg", "Emergency fund", "Emergency", "01 BASICS", "Size a cash buffer and decide where to keep it.", "mastered"],
        ["pf-crs", "Credit scores", "Credit", "02 CREDIT", "What moves a score, and what a lender reads from it.", "mastered"],
        ["pf-dbt", "Debt payoff", "Debt", "02 CREDIT", "Compare avalanche and snowball payoff orders.", "developing"],
        ["pf-cmp", "Compound interest", "Compound", "03 GROWTH", "How interest on interest grows a balance over time.", "provisional"],
        ["pf-idx", "Index funds", "Index funds", "03 GROWTH", "Why low-fee broad funds beat most stock picking.", "developing"],
        ["pf-tax", "Taxes 101", "Taxes", "04 PLANNING", "Marginal rates, deductions and what a paycheck withholds.", "not_started"],
        ["pf-ret", "Retirement accounts", "Retirement", "04 PLANNING", "401(k), IRA and Roth: who gets which tax break.", "not_started"],
      ]),
    ],
    attempts: [], provenDays: new Set<string>(), taskDone: new Set<string>(), peakPoints: 0, seq: 0,
  };
}
