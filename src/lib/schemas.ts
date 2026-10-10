import { z } from "zod";

export const MasteryState = z.enum(["not_started", "developing", "needs_work", "provisional", "mastered"]);
export type MasteryState = z.infer<typeof MasteryState>;

/** Card status is a 3-value view of the stored state. not_started rows are hidden from review cards. */
export const cardStatus = (s: MasteryState) =>
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
  z.object({ result: z.literal("fail"), nextAttemptId: z.string().nullable(), followUp: z.string().nullable() }),
]);
export type TransferResult = z.infer<typeof TransferResult>;

export const ApiError = z.object({ error: z.string() });
