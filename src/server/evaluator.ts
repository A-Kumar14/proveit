import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiEnabled, model } from "./ai";
import { AUTHORED } from "./content";
import type { Evaluation } from "@proveit/lib/schemas";

export type Judgement = {
  verdict: "correct" | "incorrect" | "uncertain";
  /** Exact substring of the judged text, or null. */
  quote: string | null;
  votes: Evaluation["votes"];
};

const CHECKS = 3;

const Check = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  misconceptionId: z.string().nullable().describe("An id from the misconception list, or null."),
  evidenceQuote: z.string().nullable().describe("A phrase copied exactly from the student's answer that shows the error, or null."),
});

const SYSTEM = `You grade a student's explanation against course material.
Rules:
- The course material below is the only grading authority.
- Mark "incorrect" only when the answer clearly states one of the listed misconceptions. Quote the exact phrase.
- Mark "uncertain" when the answer is too short or vague to tell. Never guess a misconception.
- Mark "correct" only when the answer matches the course material in its own words.
- Calculation slips, wording quibbles and missing detail are not misconceptions.`;

/** Independent checks vote. A split with no majority becomes "uncertain" rather than a guess. */
async function vote(conceptId: string, answer: string): Promise<Judgement> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  const prompt = `Question: ${a.question}
Course material: ${a.correct}
Known misconceptions: ${JSON.stringify([{ id: a.misconception.id, name: a.misconception.name, description: a.misconception.gap }])}

Student answer:
"""
${answer}
"""`;
  const checks = await Promise.all(
    Array.from({ length: CHECKS }, () => generateText({ model: model(), system: SYSTEM, prompt, output: Output.object({ schema: Check }), temperature: 0.7 }).then((r) => r.output)),
  );
  const count = (v: Check["verdict"]) => checks.filter((c) => c.verdict === v).length;
  const winner = (["incorrect", "correct", "uncertain"] as const).find((v) => count(v) > CHECKS / 2);
  if (!winner) return { verdict: "uncertain", quote: null, votes: { agree: Math.max(count("incorrect"), count("correct"), count("uncertain")), of: CHECKS } };
  const quote = checks.find((c) => c.verdict === winner && c.evidenceQuote && answer.includes(c.evidenceQuote))?.evidenceQuote ?? null;
  return { verdict: winner, quote: winner === "incorrect" ? quote : null, votes: { agree: count(winner), of: CHECKS } };
}
type Check = z.infer<typeof Check>;

export async function judgeAnswer(conceptId: string, answer: string): Promise<Judgement> {
  if (aiEnabled()) return vote(conceptId, answer);
  const j = AUTHORED[conceptId]?.judge(answer);
  if (!j) throw new Error(`no authored content for ${conceptId}`);
  return { verdict: j.verdict, quote: j.quote, votes: null };
}

const Pass = z.object({ passes: z.boolean() });

export async function judgeTransfer(conceptId: string, answer: string): Promise<boolean> {
  const a = AUTHORED[conceptId];
  if (!a) throw new Error(`no authored content for ${conceptId}`);
  if (!aiEnabled()) return a.transfer.judge(answer);
  const prompt = `Grade this answer to a transfer question. Be strict: all parts of the rubric must be present.
Question: ${a.transfer.question}
Rubric: ${a.transfer.rubric}
Student answer:
"""
${answer}
"""`;
  const results = await Promise.all(
    Array.from({ length: CHECKS }, () => generateText({ model: model(), prompt, output: Output.object({ schema: Pass }), temperature: 0.7 }).then((r) => r.output.passes)),
  );
  return results.filter(Boolean).length > CHECKS / 2;
}
