import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { aiEnabled, model } from "./ai";
import { getLearningSpec } from "./learningSpecStore";
import { compile, keyTex, notesTex, paperTex, type Notes, type Paper } from "./latex";
import { courseMaterial } from "./materials";
import { getCourse, getMisconceptionLog, getQuizSignal } from "./store";
import type { MasteryState, PracticeDoc, PracticeResult } from "@proveit/lib/schemas";

const QUESTIONS = 10;
const MARKS = 5;

export type Weak = {
  id: string; name: string; desc: string; state: MasteryState; weak: boolean;
  /** Course-material truth for concepts with a canonical learning spec. */
  material: string | null;
  mistakes: { name: string; gap: string; quote: string | null; fix: string }[];
};

/**
 * What the student should revisit. Confirmed mastery state and open misconceptions are primary.
 * A recent low quiz score is only a prioritization signal; it never changes mastery by itself.
 */
export function getWeakness(courseId: string): { courseName: string; concepts: Weak[] } {
  const course = getCourse(courseId);
  const log = getMisconceptionLog(courseId).filter((m) => m.open);
  const concepts = course.concepts.map((c): Weak => {
    const spec = getLearningSpec(courseId, c.id);
    const mistakes = log.filter((m) => m.concept === c.name).map((m) => {
      const def = spec?.misconceptions.find((x) => x.name === m.name);
      const remediation = def ? spec?.remediations.find((r) => r.misconceptionId === def.id) : null;
      return {
        name: m.name,
        gap: def?.description ?? m.gap ?? m.note,
        quote: m.quote,
        fix: remediation ? `${remediation.actuallyTrue} ${remediation.explanation}` : "",
      };
    });
    const quiz = getQuizSignal(courseId, c.id);
    const quizWeak = Boolean(quiz && quiz.pct < 60);
    return {
      id: c.id,
      name: c.name,
      desc: c.desc,
      state: c.state,
      weak: c.state === "needs_work" || c.state === "developing" || mistakes.length > 0 || quizWeak,
      material: spec?.assessment.correctAnswer ?? null,
      mistakes,
    };
  });
  return { courseName: course.name, concepts };
}

// Weak concepts first, each twice, then one question per remaining concept.
function plan(concepts: Weak[]): Weak[] {
  const weak = concepts.filter((c) => c.weak);
  const rest = concepts.filter((c) => !c.weak);
  return [...weak, ...weak, ...rest].slice(0, QUESTIONS);
}

const PaperOut = z.object({
  title: z.string(),
  questions: z.array(z.object({ concept: z.string(), prompt: z.string(), marks: z.number().int().min(1).max(10) })),
  key: z.array(z.object({ answer: z.string(), marking: z.string() })),
});

function offlinePaper(courseId: string, w: ReturnType<typeof getWeakness>): Paper {
  const seen = new Map<string, number>();
  const questions: Paper["questions"] = [];
  const key: Paper["key"] = [];
  for (const c of plan(w.concepts)) {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    const spec = getLearningSpec(courseId, c.id);
    if (spec) {
      const second = n > 0;
      questions.push({ concept: c.name, prompt: second ? spec.transfer.question : spec.assessment.question, marks: MARKS });
      key.push({
        answer: second ? spec.transfer.correctAnswer : spec.assessment.correctAnswer,
        marking: second ? spec.transfer.rubric : spec.assessment.rubric,
      });
    } else {
      questions.push({ concept: c.name, prompt: `Explain ${c.name} in your own words and give one example.`, marks: MARKS });
      key.push({ answer: c.desc, marking: "Award marks for a correct explanation of the idea and a fitting example." });
    }
  }
  return { title: "Sample question paper", courseName: w.courseName, questions, key };
}

async function buildPaper(courseId: string): Promise<Paper> {
  const w = getWeakness(courseId);
  if (!aiEnabled()) return offlinePaper(courseId, w);
  const { output } = await generateText({
    model: model(),
    system: `You write a sample exam paper and its answer key for one course.
- Exactly ${QUESTIONS} open-ended questions, ${MARKS} marks each, at least 6 of them on concepts marked weak. Cover each weak concept before repeating one.
- For a weak concept with listed mistakes, write at least one question that a student with that mistake would get wrong.
- "key" has one entry per question in the same order. "answer" is the correct answer. "marking" says what earns the marks.
- Use only the course material given, including courseNotes. No outside facts. Plain text, no LaTeX, no markdown.
- Write any non-Latin script in Latin letters, such as pinyin for Chinese, because the PDF font can't show other scripts.`,
    output: Output.object({ schema: PaperOut }),
    prompt: JSON.stringify({ course: w.courseName, courseNotes: courseMaterial(courseId, 20_000), concepts: w.concepts.map((c) => ({ name: c.name, about: c.desc, weak: c.weak, courseMaterial: c.material, mistakes: c.mistakes.map((m) => ({ name: m.name, whatIsWrong: m.gap })) })) }),
  });
  if (output.questions.length === 0 || output.key.length !== output.questions.length) throw new Error("the model returned a paper whose key doesn't match");
  return { title: output.title.trim() || "Sample question paper", courseName: w.courseName, questions: output.questions, key: output.key };
}

const SectionsOut = z.object({ sections: z.array(z.object({ concept: z.string(), summary: z.string(), points: z.array(z.string()).max(5) })) });

async function buildNotes(courseId: string): Promise<Notes> {
  const w = getWeakness(courseId);
  const ordered = [...w.concepts.filter((c) => c.weak), ...w.concepts.filter((c) => !c.weak)];
  const mistakes = w.concepts.flatMap((c) => c.mistakes.map((m) => ({ concept: c.name, said: m.quote, why: m.gap, fix: m.fix || c.material || c.desc })));
  const offline = (): Notes["sections"] => ordered.map((c) => {
    const spec = getLearningSpec(courseId, c.id);
    const remediation = spec?.remediations[0];
    return {
      concept: c.name,
      summary: spec?.assessment.correctAnswer ?? c.desc,
      points: remediation ? [remediation.title, remediation.actuallyTrue, remediation.explanation] : [],
    };
  });
  let sections = offline();
  if (aiEnabled()) {
    const { output } = await generateText({
      model: model(),
      system: `You write study notes for one course, one section per concept, in the order given.
- "summary" is two or three plain sentences. "points" has up to 5 short facts or steps.
- Use only the course material given, including courseNotes. Where none is given, stay within the description. No outside facts, no LaTeX, no markdown.
- Write any non-Latin script in Latin letters, such as pinyin for Chinese, because the PDF font can't show other scripts.`,
      output: Output.object({ schema: SectionsOut }),
      prompt: JSON.stringify({ course: w.courseName, courseNotes: courseMaterial(courseId, 20_000), concepts: ordered.map((c) => ({ name: c.name, about: c.desc, courseMaterial: c.material })) }),
    });
    // Keep the concept order and names from the course, in case the model reorders or renames.
    const byName = new Map(output.sections.map((s) => [s.concept, s]));
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

export async function samplePaper(courseId: string): Promise<PracticeResult> {
  const p = await buildPaper(courseId);
  return result(await Promise.all([toDoc("Question paper", "question-paper", paperTex(p)), toDoc("Answer key", "answer-key", keyTex(p))]));
}

export async function studyNotes(courseId: string): Promise<PracticeResult> {
  return result([await toDoc("Notes", "study-notes", notesTex(await buildNotes(courseId)))]);
}
