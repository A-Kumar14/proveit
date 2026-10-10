import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiEnabled, model } from "./ai";
import { AUTHORED } from "./content";
import { assess, NotFoundError } from "./store";
import type { AuditResult, ConverseInput, ConverseResult, Turn } from "@proveit/lib/schemas";

/** The AI asks at most this many follow-ups after the opening question. */
export const MAX_FOLLOWUPS = 3;

const authored = (conceptId: string) => {
  const a = AUTHORED[conceptId];
  if (!a) throw new NotFoundError(`no content for ${conceptId}`);
  return a;
};
const transcript = (turns: Turn[]) => turns.map((t) => `${t.role === "ai" ? "Tutor" : "Student"}: ${t.text}`).join("\n");
const studentText = (turns: Turn[]) => turns.filter((t) => t.role === "student").map((t) => t.text).join("\n");

const Next = z.object({
  done: z.boolean().describe("True when the student has said enough to judge their understanding."),
  question: z.string().describe("One short spoken follow-up. Empty when done."),
});

const ASK = `You are a spoken tutor. The student is explaining a concept out loud.
- Ask ONE short follow-up that digs into something the student actually said, or asks for a concrete example of it.
- Never state the correct answer, never hint at it, never say whether they are right.
- Do not bring in ideas the student has not said, such as terms or setups from the course material. Only dig into their own words.
- Course material is below only so you can tell what is worth probing. Do not quote it.
- Plain spoken language, one or two sentences, no lists.
- Set done to true only after the student has covered the idea with enough detail to judge.`;

// Used with no key so the demo repeats. Follows the student's own words, not the content.
function offline(turns: Turn[], asked: number): ConverseResult {
  const last = turns.filter((t) => t.role === "student").at(-1)?.text ?? "";
  const said = last.split(/\s+/).slice(0, 8).join(" ");
  if (asked === 0) return { kind: "ask", text: `You said "${said}". Say more about that part, and why you think it holds.` };
  if (asked === 1) return { kind: "ask", text: "Give me a concrete example of that, with real numbers if you can." };
  return { kind: "done" };
}

export async function nextTurn(input: ConverseInput): Promise<ConverseResult> {
  const a = authored(input.conceptId);
  const asked = input.turns.filter((t) => t.role === "ai").length - 1;
  if (asked >= MAX_FOLLOWUPS) return { kind: "done" };
  if (!aiEnabled()) return offline(input.turns, asked);
  const { output } = await generateText({
    model: model(),
    system: ASK,
    output: Output.object({ schema: Next }),
    prompt: `Concept question: ${a.question}\nCourse material: ${a.correct}\nFollow-ups asked so far: ${asked} of ${MAX_FOLLOWUPS}\n\nConversation:\n${transcript(input.turns)}`,
  });
  if (output.done && asked >= 1) return { kind: "done" };
  // Too early to stop and no question came back, so ask the offline one rather than end on nothing.
  return output.question.trim() ? { kind: "ask", text: output.question.trim() } : offline(input.turns, asked);
}

const Audit = z.object({
  right: z.array(z.object({ quote: z.string(), note: z.string() })),
  off: z.array(z.object({ quote: z.string(), note: z.string(), fix: z.string() })),
  missing: z.array(z.string()),
});

const AUDIT = `You audit what a student said out loud against course material.
- The course material is the only authority.
- "right": things the student said that match it. "off": things that contradict it. "missing": ideas from the material they never touched.
- Every quote must be copied exactly from the student's words. No paraphrase.
- "note" is one short sentence. "fix" is the correct idea in one sentence.
- Be specific and brief. No praise, no emoji. Leave a list empty rather than pad it.`;

export async function audit(input: ConverseInput): Promise<AuditResult> {
  const a = authored(input.conceptId);
  const said = studentText(input.turns);
  const { attemptId, evaluation } = await assess({ courseId: input.courseId, conceptId: input.conceptId, answer: said.slice(0, 4000) });
  const base = { attemptId, verdict: evaluation.verdict };

  if (!aiEnabled()) {
    if (evaluation.verdict === "incorrect" && evaluation.evidenceQuote) {
      return { ...base, right: [], off: [{ quote: evaluation.evidenceQuote, note: evaluation.gapSentence ?? a.misconception.gap, fix: a.correct }], missing: [] };
    }
    if (evaluation.verdict === "correct") {
      const first = input.turns.find((t) => t.role === "student")!.text;
      return { ...base, right: [{ quote: first.slice(0, 120), note: "This matches the course material." }], off: [], missing: [] };
    }
    return { ...base, right: [], off: [], missing: [a.correct] };
  }

  const { output } = await generateText({
    model: model(),
    system: AUDIT,
    output: Output.object({ schema: Audit }),
    prompt: `Question: ${a.question}\nCourse material: ${a.correct}\nKnown misconception: ${a.misconception.gap}\n\nConversation:\n${transcript(input.turns)}`,
  });
  // A quote the student never said is dropped, so the audit can't invent evidence.
  const real = (q: string) => q.trim().length > 0 && said.includes(q);
  return { ...base, right: output.right.filter((r) => real(r.quote)), off: output.off.filter((o) => real(o.quote)), missing: output.missing };
}
