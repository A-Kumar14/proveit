import { z } from "zod";

export const MasteryState = z.enum(["not_started", "developing", "needs_work", "provisional", "mastered"]);
export type MasteryState = z.infer<typeof MasteryState>;

/** Every learner response is stored as evidence. The kind records where it occurred in the learning loop. */
export const AttemptKind = z.enum(["initial", "clarification", "transfer", "review", "quiz"]);
export type AttemptKind = z.infer<typeof AttemptKind>;

/** Outcome is separate from kind so failed transfer/review evidence is never lost. */
export const AttemptOutcome = z.enum(["correct", "incorrect", "uncertain", "pass", "fail"]);
export type AttemptOutcome = z.infer<typeof AttemptOutcome>;

/** Card status is a 3-value view of the stored state. not_started rows are hidden from review cards. */
export const cardStatus = (s: MasteryState): "mastered" | "reteaching" | "transfer-pending" | null =>
  s === "mastered" ? "mastered"
  : s === "provisional" || s === "developing" ? "transfer-pending"
  : s === "needs_work" ? "reteaching"
  : null;

// ---- API contracts (what route handlers accept and return) ----

export const AssessInput = z.object({
  courseId: z.string(),
  conceptId: z.string(),
  answer: z.string().trim().min(1, "Write an answer first.").max(4000),
  followUpTo: z.string().optional(),
  learningSpecRevision: z.number().int().positive().optional(),
  /** Transcription of an uploaded photo that passed the upload check. Judged together with the typed answer. */
  imageSummary: z.string().max(2000).optional(),
  imageName: z.string().max(200).optional(),
});
export type AssessInput = z.infer<typeof AssessInput>;

export const ErrorType = z.enum(["none", "conceptual", "procedural", "slip", "interpretation", "flawed_reasoning", "uncertain"]);

export const Evaluation = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  errorType: ErrorType,
  misconceptionId: z.string().nullable(),
  misconceptionName: z.string().nullable(),
  /** Exact substring of the student's answer, used for the highlight. */
  evidenceQuote: z.string().nullable(),
  gapSentence: z.string().nullable(),
  skills: z.array(z.object({ label: z.string(), pct: z.number().min(0).max(100) })),
  /** "N of 3 checks agree". Null when the evaluator did not run independent checks; the UI then hides the badge. */
  votes: z.object({ agree: z.number().int(), of: z.number().int() }).nullable(),
  followUp: z.string().nullable(),
  recommendation: z.string(),
});
export type Evaluation = z.infer<typeof Evaluation>;

export const AssessResult = z.object({ attemptId: z.string(), evaluation: Evaluation });
export type AssessResult = z.infer<typeof AssessResult>;

export const ClarifyInput = z.object({ attemptId: z.string() });
export const ClarifyResult = z.object({ conceptId: z.string(), courseId: z.string(), followUp: z.string() });

export const TransferInput = z.object({
  attemptId: z.string(),
  answer: z.string().trim().min(1, "Write an answer first.").max(4000),
});
export const TransferResult = z.discriminatedUnion("result", [
  z.object({ result: z.literal("pass"), resultAttemptId: z.string() }),
  z.object({ result: z.literal("fail"), failedAttemptId: z.string(), nextAttemptId: z.string().nullable(), followUp: z.string().nullable() }),
]);
export type TransferResult = z.infer<typeof TransferResult>;

export const ReviewSubmitInput = z.object({
  courseId: z.string(),
  conceptId: z.string(),
  answer: z.string().trim().min(1, "Write an answer first.").max(4000),
  /** Optional pin to the exact challenge revision shown to the learner. */
  learningSpecRevision: z.number().int().positive().optional(),
});
export type ReviewSubmitInput = z.infer<typeof ReviewSubmitInput>;

export const ReviewSubmitResult = z.discriminatedUnion("result", [
  z.object({ result: z.literal("pass"), resultAttemptId: z.string() }),
  z.object({ result: z.literal("fail"), failedAttemptId: z.string(), nextAttemptId: z.string() }),
  z.object({ result: z.literal("uncertain"), attemptId: z.string(), followUp: z.string() }),
]);
export type ReviewSubmitResult = z.infer<typeof ReviewSubmitResult>;

export const ApiError = z.object({ error: z.string() });

// ---- courses ----

export const CourseCompleteInput = z.object({
  ids: z.array(z.string()).min(1, "Select at least one course.").max(50),
  completed: z.boolean(),
});
export type CourseCompleteInput = z.infer<typeof CourseCompleteInput>;
export const CourseCompleteResult = z.object({ updated: z.array(z.string()) });

// ---- to-do and calendar ----

export const TaskDoneInput = z.object({ id: z.string().min(1), done: z.boolean() });
export const CalendarConnectInput = z.object({ url: z.string().trim().min(1, "Paste your calendar link.").max(2000) });
export const Ok = z.object({ ok: z.literal(true) });

// ---- mastery review (Tutor card) ----

/** Only these fields come from the model. Numbers and statuses are computed in code and stay stable across runs. */
export const ReviewText = z.object({
  misconceptions: z.array(z.object({ concept: z.string(), misconception: z.string().nullable() })),
  biggestRisk: z.object({ reason: z.string() }),
  recommendation: z.string(),
  nextActions: z.array(z.string()),
});
export type ReviewText = z.infer<typeof ReviewText>;

export const MasteryReview = z.object({
  headline: z.string(),
  concepts: z.array(z.object({
    name: z.string(),
    mastery: z.number().min(0).max(100),
    status: z.enum(["mastered", "reteaching", "transfer-pending"]),
    misconception: z.string().nullable(),
  })),
  biggestRisk: z.object({ concept: z.string(), reason: z.string() }),
  recommendation: z.string(),
  nextActions: z.array(z.string()),
});
export type MasteryReview = z.infer<typeof MasteryReview>;

export const ReviewInput = z.object({ courseId: z.string() });

// ---- upload check ----

/** Snake case on purpose: this is the shape the handoff names for POST /api/upload/check. */
export const UploadCheck = z.object({
  is_student_work: z.boolean(),
  relevant: z.boolean(),
  summary: z.string(),
  reason: z.string(),
});
export type UploadCheck = z.infer<typeof UploadCheck>;

// ---- spoken conversation ----

export const Turn = z.object({ role: z.enum(["ai", "student"]), text: z.string().trim().min(1).max(2000) });
export type Turn = z.infer<typeof Turn>;

/** The first turn is the question the AI asked. Student and AI turns then alternate. */
export const ConverseInput = z.object({
  courseId: z.string(),
  conceptId: z.string(),
  turns: z.array(Turn).min(2).max(20),
});
export type ConverseInput = z.infer<typeof ConverseInput>;
export const ConverseResult = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ask"), text: z.string() }),
  z.object({ kind: z.literal("done") }),
]);
export type ConverseResult = z.infer<typeof ConverseResult>;

export const AuditResult = z.object({
  attemptId: z.string(),
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  /** Every quote is an exact phrase from what the student said. */
  right: z.array(z.object({ quote: z.string(), note: z.string() })),
  off: z.array(z.object({ quote: z.string(), note: z.string(), fix: z.string() })),
  missing: z.array(z.string()),
});
export type AuditResult = z.infer<typeof AuditResult>;

// ---- practice documents ----

export const PracticeInput = z.object({ courseId: z.string() });
export const PracticeDoc = z.object({
  label: z.string(),
  /** File name without extension. */
  name: z.string(),
  tex: z.string(),
  /** Base64 PDF, or null when the compile failed. The .tex is still usable. */
  pdf: z.string().nullable(),
});
export const PracticeResult = z.object({ docs: z.array(PracticeDoc), pdfError: z.string().nullable() });
export type PracticeDoc = z.infer<typeof PracticeDoc>;
export type PracticeResult = z.infer<typeof PracticeResult>;


// ---- tutor chat ----

export const TutorMessage = z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(8000) });
export type TutorMessage = z.infer<typeof TutorMessage>;
export const TutorMessages = z.array(TutorMessage).min(1).max(40);

// ---- course catalog ----

export const CatalogAddInput = z.object({ id: z.string().min(1).max(80) });
export const CatalogAddResult = z.object({ id: z.string(), added: z.boolean() });
export const CatalogRemoveResult = z.object({ removed: z.boolean() });

// ---- course files ----

export const FileRemoveInput = z.object({ courseId: z.string(), id: z.string() });
export const FileUploadResult = z.object({
  added: z.array(z.object({ id: z.string(), name: z.string(), words: z.number(), readBy: z.enum(["text", "ai"]) })),
  failed: z.array(z.object({ name: z.string(), reason: z.string() })),
});
export type FileUploadResult = z.infer<typeof FileUploadResult>;

// ---- quiz ----

export const QuizStartInput = z.object({ courseId: z.string(), count: z.number().int().min(1).max(15).optional(), /** Quiz one concept only. */ conceptId: z.string().optional() });
/** A question as the student sees it. The answer stays on the server until the quiz is submitted. */
export const QuizQuestion = z.object({ id: z.string(), concept: z.string(), prompt: z.string(), options: z.array(z.string()).length(4) });
export const QuizStartResult = z.object({ quizId: z.string(), courseName: z.string(), questions: z.array(QuizQuestion), aiWritten: z.boolean() });
export type QuizQuestion = z.infer<typeof QuizQuestion>;
export type QuizStartResult = z.infer<typeof QuizStartResult>;

export const QuizSubmitInput = z.object({ quizId: z.string(), answers: z.array(z.number().int().min(0).max(3).nullable()).max(30) });
export const QuizResult = z.object({
  quizId: z.string(), courseId: z.string(), courseName: z.string(),
  score: z.number(), total: z.number(), pct: z.number(),
  items: z.array(QuizQuestion.extend({ conceptId: z.string(), picked: z.number().nullable(), correct: z.number(), explanation: z.string() })),
  byConcept: z.array(z.object({ conceptId: z.string(), concept: z.string(), right: z.number(), total: z.number() })),
  /** How the quiz moved the course map. Empty when nothing changed state. */
  changes: z.array(z.object({ conceptId: z.string(), concept: z.string(), from: MasteryState, to: MasteryState })),
  pointsGained: z.number(),
});
export type QuizResult = z.infer<typeof QuizResult>;

// ---- connected apps and course creation ----

export const ProviderInput = z.object({ provider: z.enum(["granola", "wispr"]) });
export const ConnectInput = ProviderInput.extend({ returnTo: z.string().max(300).optional() });
export const ConnectResult = z.union([z.object({ url: z.string() }), z.object({ connected: z.literal(true) })]);
export const ImportInput = ProviderInput.extend({ topic: z.string().trim().min(2, "Say what the course is about.").max(120), name: z.string().trim().max(80).optional() });
export const CreateCourseResult = z.object({ id: z.string(), concepts: z.number(), documents: z.number().optional(), failed: z.array(z.object({ name: z.string(), reason: z.string() })).optional() });
export type CreateCourseResult = z.infer<typeof CreateCourseResult>;

// ---- course upload ----

/** What the model (or the outline parser) pulls out of uploaded course files. The store trims it to fit the map. */
export const CourseOutline = z.object({
  units: z.array(z.object({
    name: z.string().describe("Short unit name, 1 to 3 words."),
    concepts: z.array(z.object({
      name: z.string().describe("Concept name, at most 5 words."),
      short: z.string().describe("1 or 2 word label for the map node."),
      desc: z.string().describe("One sentence saying what the student must be able to do."),
    })),
  })),
  prerequisites: z.array(z.object({ from: z.string(), to: z.string() })).describe("Concept names. `from` must be understood before `to`. Only real logical dependencies."),
});
export type CourseOutline = z.infer<typeof CourseOutline>;

/** The upload starts a build and returns at once. The browser then polls the job for its stage. */
export const CourseUploadResult = z.object({ jobId: z.string() });
export const CourseJobView = z.object({
  id: z.string(), name: z.string(),
  stage: z.enum(["reading", "outline", "building", "saving", "done", "failed", "cancelled"]),
  stages: z.array(z.object({ id: z.string(), label: z.string(), state: z.enum(["waiting", "active", "done", "failed"]) })),
  files: z.array(z.object({ name: z.string(), state: z.enum(["waiting", "reading", "done", "failed"]), note: z.string().optional() })),
  courseId: z.string().optional(), error: z.string().optional(), concepts: z.number().optional(), elapsedMs: z.number(),
});
export type CourseJobView = z.infer<typeof CourseJobView>;

