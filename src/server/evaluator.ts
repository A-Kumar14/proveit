import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiEnabled, model } from "./ai";
import { AUTHORED } from "./content";
import type { Evaluation } from "@proveit/lib/schemas";

export type Judgement = {
  verdict: "correct" | "incorrect" | "uncertain";
  quote: string | null;
  misconceptionId: string | null;
  votes: Evaluation["votes"];
};

export type AnswerContext = {
  previous: { answer: string; verdict: "correct" | "incorrect" | "uncertain"; misconceptionId: string | null }[];
  followUpPrompt: string | null;
};

export type TransferJudgement = {
  verdict: "pass" | "fail" | "uncertain";
  quote: string | null;
  misconceptionId: string | null;
  feedback: string | null;
  votes: Evaluation["votes"];
};

const CHECKS = 3;
const TEMPERATURE = 0.2;

const Check = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  misconceptionId: z.string().nullable(),
  evidenceQuote: z.string().nullable(),
});
type Check = z.infer<typeof Check>;

const ChallengeCheck = z.object({
  verdict: z.enum(["pass", "fail", "uncertain"]),
  misconceptionId: z.string().nullable(),
  evidenceQuote: z.string().nullable(),
  feedback: z.string().max(240).nullable(),
});
type ChallengeCheck = z.infer<typeof ChallengeCheck>;

const SYSTEM = `You grade a student's explanation against course material.
Rules:
- The course material below is the only grading authority.
- Mark "incorrect" only when the CURRENT answer clearly states one of the listed misconceptions. Quote the exact phrase from the current answer.
- Mark "uncertain" when the current evidence is too short, vague or ambiguous. Never guess a misconception.
- Mark "correct" only when the current evidence demonstrates the course material in the student's own words.
- Earlier responses are context, not permanent truth. If the current clarification explicitly corrects an earlier statement, the later clarification supersedes it.
- Calculation slips, wording quibbles and missing detail are not misconceptions.`;

const CHALLENGE_SYSTEM = `You grade a retrieval or transfer challenge against its rubric.
Rules:
- "pass" only when every required part of the rubric is demonstrated.
- "fail" only when the current answer clearly contradicts the rubric or clearly states a listed misconception.
- "uncertain" when the answer is incomplete, vague or ambiguous rather than clearly wrong.
- If a listed misconception clearly explains the failure, return its exact id; otherwise return null.
- Quote only exact text from the CURRENT answer.
- Feedback must be brief, diagnostic, and must not reveal the full correct answer.`;

const count = <T extends string>(rows: { verdict: T }[], verdict: T) => rows.filter((r) => r.verdict === verdict).length;
const majority = <T extends string>(rows: { verdict: T }[], ordered: readonly T[]) =>
  ordered.find((v) => count(rows, v) > rows.length / 2) ?? null;

function majorityMisconception<T extends { verdict: string; misconceptionId: string | null }>(
  rows: T[], verdict: string, allowed: Set<string>,
): { id: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.verdict !== verdict || !row.misconceptionId || !allowed.has(row.misconceptionId)) continue;
    counts.set(row.misconceptionId, (counts.get(row.misconceptionId) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > rows.length / 2 ? { id: top[0], count: top[1] } : null;
}

function contextBlock(context?: AnswerContext) {
  if (!context?.previous.length) return "";
  const prior = context.previous.map((p, i) =>
    `Earlier response ${i + 1} [${p.verdict}${p.misconceptionId ? `, ${p.misconceptionId}` : ""}]:
"""
${p.answer}
"""`
  ).join("\n");
  return `
Earlier evidence in this same learning episode:
${prior}
${context.followUpPrompt ? `Follow-up the student is answering now: ${context.followUpPrompt}` : ""}
Evaluate the CURRENT answer below as the latest evidence. A clear correction can supersede an earlier mistake.
`;
}

async function vote(conceptId: string, answer: string, context?: AnswerContext): Promise<Judgement> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  const prompt = `Question: ${a.question}
Course material: ${a.correct}
Known misconceptions: ${JSON.stringify(a.misconceptions.map((m) => ({ id: m.id, name: m.name, description: m.gap })))}
${contextBlock(context)}
CURRENT student answer:
"""
${answer}
"""`;
  const checks = await Promise.all(
    Array.from({ length: CHECKS }, () => generateText({ model: model(), system: SYSTEM, prompt, output: Output.object({ schema: Check }), temperature: TEMPERATURE }).then((r) => r.output)),
  );
  const winner = majority(checks, ["incorrect", "correct", "uncertain"] as const);
  const maxVotes = Math.max(...(["incorrect", "correct", "uncertain"] as const).map((v) => count(checks, v)));
  if (!winner) return { verdict: "uncertain", quote: null, misconceptionId: null, votes: { agree: maxVotes, of: CHECKS } };
  if (winner !== "incorrect") return { verdict: winner, quote: null, misconceptionId: null, votes: { agree: count(checks, winner), of: CHECKS } };
  const allowed = new Set(a.misconceptions.map((m) => m.id));
  const diagnosis = majorityMisconception(checks, "incorrect", allowed);
  if (!diagnosis) return { verdict: "uncertain", quote: null, misconceptionId: null, votes: { agree: count(checks, "incorrect"), of: CHECKS } };
  const quote = checks.find((c) => c.verdict === "incorrect" && c.misconceptionId === diagnosis.id && c.evidenceQuote && answer.includes(c.evidenceQuote))?.evidenceQuote ?? null;
  return { verdict: "incorrect", quote, misconceptionId: diagnosis.id, votes: { agree: diagnosis.count, of: CHECKS } };
}

export async function judgeAnswer(conceptId: string, answer: string, context?: AnswerContext): Promise<Judgement> {
  if (aiEnabled()) return vote(conceptId, answer, context);
  const j = AUTHORED[conceptId]?.judge(answer);
  if (!j) throw new Error(`no authored content for ${conceptId}`);
  return { verdict: j.verdict, quote: j.quote, misconceptionId: j.misconceptionId, votes: null };
}

async function voteChallenge(conceptId: string, answer: string, kind: "transfer" | "review"): Promise<TransferJudgement> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  const challenge = a[kind];
  const label = kind === "review" ? "Delayed review" : "Transfer";
  const prompt = `${label} question: ${challenge.question}
Rubric: ${challenge.rubric}
Known misconceptions: ${JSON.stringify(a.misconceptions.map((m) => ({ id: m.id, name: m.name, description: m.gap })))}

CURRENT student answer:
"""
${answer}
"""`;
  const checks = await Promise.all(
    Array.from({ length: CHECKS }, () => generateText({ model: model(), system: CHALLENGE_SYSTEM, prompt, output: Output.object({ schema: ChallengeCheck }), temperature: TEMPERATURE }).then((r) => r.output)),
  );
  const winner = majority(checks, ["fail", "pass", "uncertain"] as const);
  const maxVotes = Math.max(...(["fail", "pass", "uncertain"] as const).map((v) => count(checks, v)));
  if (!winner) return { verdict: "uncertain", quote: null, misconceptionId: null, feedback: "Give one more precise sentence that addresses every part of the question.", votes: { agree: maxVotes, of: CHECKS } };
  const agreeing = checks.filter((c) => c.verdict === winner);
  const feedback = agreeing.find((c) => c.feedback?.trim())?.feedback ?? (winner === "pass" ? null : "Give one more precise sentence that addresses every part of the question.");
  if (winner !== "fail") return { verdict: winner, quote: null, misconceptionId: null, feedback, votes: { agree: agreeing.length, of: CHECKS } };
  const allowed = new Set(a.misconceptions.map((m) => m.id));
  const diagnosis = majorityMisconception(checks, "fail", allowed);
  const quote = diagnosis
    ? checks.find((c) => c.verdict === "fail" && c.misconceptionId === diagnosis.id && c.evidenceQuote && answer.includes(c.evidenceQuote))?.evidenceQuote ?? null
    : null;
  return { verdict: "fail", quote, misconceptionId: diagnosis?.id ?? null, feedback, votes: { agree: diagnosis?.count ?? agreeing.length, of: CHECKS } };
}

export async function judgeTransfer(conceptId: string, answer: string): Promise<TransferJudgement> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  if (aiEnabled()) return voteChallenge(conceptId, answer, "transfer");
  return { ...a.transfer.judge(answer), votes: null };
}

export async function judgeReview(conceptId: string, answer: string): Promise<TransferJudgement> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  if (aiEnabled()) return voteChallenge(conceptId, answer, "review");
  return { ...a.review.judge(answer), votes: null };
}
