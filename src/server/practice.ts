import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiEnabled, model } from "./ai";
import { AUTHORED } from "./content";
import { compile, keyTex, notesTex, paperTex, type Notes, type Paper } from "./latex";
import { courseMaterial } from "./materials";
import { splitByConcept } from "./parallel";
import { getCourse, getMisconceptionLog } from "./store";
import type { MasteryState, PracticeDoc, PracticeResult } from "@proveit/lib/schemas";

/** Course text sent with a paper or notes request. More barely changes the result and slows the model. */
const NOTES_CHARS = 30_000;
/** The model writes about 100 tokens a second, so a paper is written in parallel parts, each about half the size. */
const PARALLEL_PAPER = 2;
const PARALLEL_NOTES = 4;
const QUESTIONS = 10;
const MODEL_TIMEOUT_MS = 90_000;
const MARKS = 5;

export type Weak = {
  id: string; name: string; desc: string; state: MasteryState; weak: boolean;
  /** Course-material truth for concepts that have authored content. */
  material: string | null;
  mistakes: { name: string; gap: string; quote: string | null; fix: string }[];
};

/** What the student keeps getting wrong. Weak means needs work, developing, or an open mistake. */
export function getWeakness(courseId: string): { courseName: string; concepts: Weak[] } {
  const course = getCourse(courseId);
  const log = getMisconceptionLog(courseId).filter((m) => m.open);
  const concepts = course.concepts.map((c): Weak => {
    const au = AUTHORED[c.id];
    const mistakes = log.filter((m) => m.concept === c.name).map((m) => {
      const def = au?.misconceptions.find((x) => x.name === m.name);
      return { name: m.name, gap: def?.gap ?? m.note, quote: m.quote, fix: au ? `${au.lesson.actuallyTrue} ${au.lesson.explanation}` : "" };
    });
    return { id: c.id, name: c.name, desc: c.desc, state: c.state, weak: c.state === "needs_work" || c.state === "developing" || mistakes.length > 0, material: au?.correct ?? null, mistakes };
  });
  return { courseName: course.name, concepts };
}

// Weak concepts first, each twice, then one question per remaining concept.
function plan(concepts: Weak[]): Weak[] {
  const weak = concepts.filter((c) => c.weak);
  const rest = concepts.filter((c) => !c.weak);
  return [...weak, ...weak, ...rest].slice(0, QUESTIONS);
}

function offlinePaper(w: ReturnType<typeof getWeakness>): Paper {
  const seen = new Map<string, number>();
  const questions: Paper["questions"] = [];
  const key: Paper["key"] = [];
  for (const c of plan(w.concepts)) {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    const au = AUTHORED[c.id];
    if (au) {
      const second = n > 0;
      questions.push({ concept: c.name, prompt: second ? au.transfer.question : au.question, marks: MARKS });
      key.push({ answer: au.correct, marking: second ? au.transfer.rubric : `Full marks for the idea above. Deduct for: ${au.misconceptions.map((m) => m.gap).join(" ")}` });
    } else {
      questions.push({ concept: c.name, prompt: `Explain ${c.name} in your own words and give one example.`, marks: MARKS });
      key.push({ answer: c.desc, marking: "Award marks for a correct explanation of the idea and a fitting example." });
    }
  }
  return { title: "Sample question paper", courseName: w.courseName, questions, key };
}

const PaperPart = z.object({
  questions: z.array(z.object({ concept: z.string(), prompt: z.string(), marks: z.number().int().min(1).max(10) })),
  key: z.array(z.object({ answer: z.string(), marking: z.string() })),
});

const PAPER_SYSTEM = (n: number) => `You write part of a sample exam paper and its answer key for one course.
- Exactly ${n} open-ended questions, ${MARKS} marks each. For each concept listed, write exactly the number of questions it says. When a concept has two, make them test it from different angles.
- For a concept with listed mistakes, write at least one question that a student with that mistake would get wrong.
- "key" has one entry per question in the same order. "answer" is the correct answer. "marking" is one short sentence saying what earns the marks.
- Use only the course material given, including courseNotes. No outside facts. Plain text, no LaTeX, no markdown.
- Never write Chinese characters, because the PDF font can't show them. Write Mandarin in pinyin with tone marks, such as nǐ hǎo.`;

async function buildPaper(courseId: string): Promise<Paper> {
  const w = getWeakness(courseId);
  if (!aiEnabled()) return offlinePaper(w);
  const notes = courseMaterial(courseId, NOTES_CHARS);
  const parts = splitByConcept(plan(w.concepts), PARALLEL_PAPER);
  const written = await Promise.all(parts.map(async (slots) => {
    const wanted = new Map<string, { c: Weak; n: number }>();
    for (const c of slots) wanted.set(c.id, { c, n: (wanted.get(c.id)?.n ?? 0) + 1 });
    const { output } = await generateText({
      model: model({ fast: true }),
      system: PAPER_SYSTEM(slots.length),
      output: Output.object({ schema: PaperPart }),
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      prompt: JSON.stringify({ course: w.courseName, courseNotes: notes, concepts: [...wanted.values()].map(({ c, n }) => ({ name: c.name, about: c.desc, questions: n, weak: c.weak, courseMaterial: c.material, mistakes: c.mistakes.map((m) => ({ name: m.name, whatIsWrong: m.gap })) })) }),
    });
    if (output.questions.length === 0 || output.key.length !== output.questions.length) throw new Error("the model returned a paper whose key doesn't match");
    return output;
  }));
  return { title: "Sample question paper", courseName: w.courseName, questions: written.flatMap((x) => x.questions), key: written.flatMap((x) => x.key) };
}

const SectionsOut = z.object({ sections: z.array(z.object({ concept: z.string(), summary: z.string(), points: z.array(z.string()).max(5) })) });

async function buildNotes(courseId: string): Promise<Notes> {
  const w = getWeakness(courseId);
  const ordered = [...w.concepts.filter((c) => c.weak), ...w.concepts.filter((c) => !c.weak)];
  const mistakes = w.concepts.flatMap((c) => c.mistakes.map((m) => ({ concept: c.name, said: m.quote, why: m.gap, fix: m.fix || c.material || c.desc })));
  const offline = (): Notes["sections"] => ordered.map((c) => {
    const au = AUTHORED[c.id];
    return { concept: c.name, summary: au?.correct ?? c.desc, points: au ? [au.lesson.title, au.lesson.actuallyTrue, au.lesson.explanation] : [] };
  });
  let sections = offline();
  if (aiEnabled()) {
    const notes = courseMaterial(courseId, NOTES_CHARS);
    const chunks = splitByConcept(ordered, PARALLEL_NOTES);
    const outputs = await Promise.all(chunks.map(async (chunk) => (await generateText({
      model: model({ fast: true }),
      system: `You write study notes for one course, one section per concept, in the order given.
- "summary" is two or three plain sentences. "points" has up to 5 short facts or steps.
- Use only the course material given, including courseNotes. Where none is given, stay within the description. No outside facts, no LaTeX, no markdown.
- Never write Chinese characters, because the PDF font can't show them. Write Mandarin in pinyin with tone marks, such as nǐ hǎo.`,
      output: Output.object({ schema: SectionsOut }),
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      prompt: JSON.stringify({ course: w.courseName, courseNotes: notes, concepts: chunk.map((c) => ({ name: c.name, about: c.desc, courseMaterial: c.material })) }),
    })).output));
    // Keep the concept order and names from the course, in case the model reorders or renames.
    const byName = new Map(outputs.flatMap((o) => o.sections).map((s) => [s.concept, s]));
    sections = sections.map((s) => byName.get(s.concept) ?? s);
  }
  return { title: "Study notes", courseName: w.courseName, sections, mistakes };
}

async function toDoc(label: string, name: string, tex: string): Promise<{ doc: PracticeDoc; error: string | null }> {
  try {
    return { doc: { label, name, tex, pdf: (await compile(tex)).toString("base64") }, error: null };
  } catch (e) {
    console.error(e);
    return { doc: { label, name, tex, pdf: null }, error: e instanceof Error && "code" in e && e.code === "ENOENT" ? "tectonic isn't installed on the server." : "The PDF compile failed." };
  }
}

const result = (parts: { doc: PracticeDoc; error: string | null }[]): PracticeResult => ({ docs: parts.map((p) => p.doc), pdfError: parts.find((p) => p.error)?.error ?? null });

/** Logs where the time went, in development, so a slow document points at the model or at the PDF compile. */
const timed = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
  const t = performance.now();
  try { return await run(); } finally { if (process.env.NODE_ENV !== "production") console.info(`[practice] ${label} ${((performance.now() - t) / 1000).toFixed(1)}s`); }
};

export async function samplePaper(courseId: string): Promise<PracticeResult> {
  const p = await timed("paper: model", () => buildPaper(courseId));
  return result(await timed("paper: compile", () => Promise.all([toDoc("Question paper", "question-paper", paperTex(p)), toDoc("Answer key", "answer-key", keyTex(p))])));
}

export async function studyNotes(courseId: string): Promise<PracticeResult> {
  const n = await timed("notes: model", () => buildNotes(courseId));
  return result([await timed("notes: compile", () => toDoc("Notes", "study-notes", notesTex(n)))]);
}
