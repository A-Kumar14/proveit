import "server-only";
import { createHash } from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import { ConceptLearningSpec, type LearningSource } from "@proveit/lib/conceptLearningSpec";
import { aiEnabled, aiProvider, model } from "./ai";
import { getAuthoredLearningSpec } from "./authoredLearningSpecs";
import {
  getGeneratedLearningSpecRecord,
  saveGeneratedLearningSpec,
} from "./learningSpecs";
import { listMaterials } from "./materials";
import { courseSpec, getCourse, NotFoundError } from "./store";

export class LearningSpecGenerationError extends Error {}

type SourceDocument = { materialId: string; title: string; locator: string | null; text: string };
type ConceptContext = { courseId: string; courseName: string; conceptId: string; conceptName: string; unit: string; desc: string };

const DRAFT_TEXT = z.string().trim().min(1).max(2400);
const DRAFT_IDS = z.array(z.string().trim().min(1).max(120)).min(1).max(4);
const ChallengeDraft = z.object({
  question: DRAFT_TEXT,
  correctAnswer: DRAFT_TEXT,
  rubric: DRAFT_TEXT,
  hint: DRAFT_TEXT,
  sourceIds: DRAFT_IDS,
}).strict();

const GeneratedDraft = z.object({
  assessment: z.object({
    question: DRAFT_TEXT,
    correctAnswer: DRAFT_TEXT,
    rubric: DRAFT_TEXT,
    probe: DRAFT_TEXT,
    sourceIds: DRAFT_IDS,
  }).strict(),
  misconceptions: z.array(z.object({
    name: DRAFT_TEXT,
    description: DRAFT_TEXT,
    clarificationQuestion: DRAFT_TEXT,
    sourceIds: DRAFT_IDS,
    remediation: z.object({
      title: DRAFT_TEXT,
      actuallyTrue: DRAFT_TEXT,
      explanation: DRAFT_TEXT,
      sourceIds: DRAFT_IDS,
    }).strict(),
  }).strict()).min(1).max(4),
  transfer: ChallengeDraft,
  review: ChallengeDraft,
  skillLabel: z.string().trim().min(1).max(80),
}).strict();

type GeneratedDraft = z.infer<typeof GeneratedDraft>;

const STOP = new Set([
  "about", "after", "again", "also", "been", "being", "between", "could", "does", "from", "have", "into",
  "more", "most", "only", "other", "same", "than", "that", "their", "there", "these", "they", "this", "through",
  "what", "when", "where", "which", "while", "with", "would", "your", "explain", "apply",
]);

const cleanText = (s: string) => s.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
const termsFor = (name: string, desc: string) => {
  const words = `${name} ${desc}`.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [];
  return [...new Set(words.filter((w) => !STOP.has(w)))].sort((a, b) => b.length - a.length).slice(0, 18);
};

function sourceDocuments(courseId: string): SourceDocument[] {
  getCourse(courseId);
  const out: SourceDocument[] = [];
  const spec = courseSpec(courseId);
  if (spec?.material.trim()) {
    out.push({
      materialId: `course:${courseId}`,
      title: `${spec.name} course notes`,
      locator: `${spec.source} course material`,
      text: cleanText(spec.material),
    });
  }
  for (const material of listMaterials(courseId)) {
    if (!material.text.trim()) continue;
    out.push({
      materialId: material.id,
      title: material.name,
      locator: "Uploaded course material",
      text: cleanText(material.text),
    });
  }

  // Upload/import flows can preserve the same notes in more than one place. Give the model one copy.
  const seen = new Set<string>();
  return out.filter((doc) => {
    const digest = createHash("sha256").update(doc.text).digest("hex");
    if (seen.has(digest)) return false;
    seen.add(digest);
    return true;
  });
}

function relevance(doc: SourceDocument, conceptName: string, terms: string[]): number {
  const lower = doc.text.toLowerCase();
  let score = lower.includes(conceptName.toLowerCase()) ? 20 : 0;
  for (const term of terms) {
    let at = lower.indexOf(term);
    while (at >= 0) {
      score += Math.min(6, Math.max(1, Math.floor(term.length / 3)));
      at = lower.indexOf(term, at + term.length);
    }
  }
  return score;
}

function excerpt(doc: SourceDocument, conceptName: string, terms: string[]): string {
  const text = doc.text;
  const lower = text.toLowerCase();
  const needles = [conceptName.toLowerCase(), ...terms];
  let at = -1;
  for (const needle of needles) {
    at = lower.indexOf(needle);
    if (at >= 0) break;
  }
  if (at < 0) at = 0;
  const radius = 1000;
  let start = Math.max(0, at - radius);
  let end = Math.min(text.length, at + radius);
  if (start > 0) {
    const boundary = text.indexOf("\n", start);
    if (boundary >= 0 && boundary < at) start = boundary + 1;
  }
  if (end < text.length) {
    const boundary = text.lastIndexOf("\n", end);
    if (boundary > at) end = boundary;
  }
  const selected = text.slice(start, end).trim();
  return selected || text.slice(0, 2000).trim();
}

function grounding(courseId: string, conceptName: string, desc: string): { documents: SourceDocument[]; sources: LearningSource[]; fingerprint: string } {
  const documents = sourceDocuments(courseId);
  if (documents.length === 0) throw new LearningSpecGenerationError("This concept has no saved course material to ground a learning spec.");

  const terms = termsFor(conceptName, desc);
  const ranked = documents
    .map((doc, index) => ({ doc, index, score: relevance(doc, conceptName, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const useful = ranked.filter((row) => row.score > 0);
  const selected = (useful.length ? useful : ranked).slice(0, 4);

  const sources: LearningSource[] = selected.map(({ doc }, i) => ({
    id: `source-${i + 1}`,
    kind: "material_excerpt",
    materialId: doc.materialId,
    title: doc.title,
    locator: doc.locator ?? `Relevant excerpt for ${conceptName}`,
    excerpt: excerpt(doc, conceptName, terms).slice(0, 2000),
  }));

  const fingerprint = createHash("sha256").update(JSON.stringify({
    courseId,
    conceptName,
    desc,
    documents: documents.map((doc) => ({ materialId: doc.materialId, text: doc.text })),
  })).digest("hex");

  return { documents, sources, fingerprint };
}

const modelLabel = () => {
  const provider = aiProvider();
  if (provider === "openrouter") return `openrouter:${process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash"}`;
  if (provider === "google") return `google:${process.env.GEMINI_MODEL || "gemini-3.8-flash"}`;
  return "unconfigured";
};

function misconceptionIds(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name, i) => {
    const raw = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 96);
    const base = raw || `misconception_${i + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base.slice(0, 90)}_${n}`;
    used.add(id);
    return id;
  });
}

function validateReferences(draft: GeneratedDraft, sources: LearningSource[]): void {
  const known = new Set(sources.map((source) => source.id));
  const groups: string[][] = [
    draft.assessment.sourceIds,
    draft.transfer.sourceIds,
    draft.review.sourceIds,
    ...draft.misconceptions.flatMap((m) => [m.sourceIds, m.remediation.sourceIds]),
  ];
  for (const ids of groups) {
    for (const id of ids) if (!known.has(id)) {
      throw new LearningSpecGenerationError(`The model cited an unknown source id: ${id}`);
    }
  }
}

async function generate(context: ConceptContext, sources: LearningSource[], revision: number) {
  const sourcePacket = sources.map((source) => {
    if (source.kind !== "material_excerpt") throw new LearningSpecGenerationError("Generated content can only use retrieved material excerpts.");
    return { id: source.id, title: source.title, locator: source.locator, excerpt: source.excerpt };
  });

  let draft: GeneratedDraft;
  try {
    const result = await generateText({
      model: model(),
      system: `You design one mastery-learning specification from a student's course material.
The supplied excerpts are the ONLY factual authority. Do not use outside facts, even if you know them.
Write content that tests understanding, not trivia.
- Assessment: an open question the learner must explain or apply in their own words.
- Misconceptions: 1-4 concrete wrong reasoning patterns that are plausible for this concept. Do not claim they are common or empirically prevalent unless the excerpts say so.
- Remediation: one targeted repair for each misconception; teach only the gap and stay inside the supplied material.
- Transfer: materially different surface form or scenario that tests the same competency. It must be solvable from the excerpts, not by memorizing the assessment wording.
- Review: a third, distinct delayed-retrieval surface form.
- Hints guide retrieval without giving the complete answer.
Every sourceIds array must contain one or more IDs from the supplied sources. Never invent a source ID.
The rubric must state what visible evidence a response must demonstrate. Do not ask for hidden chain-of-thought.`,
      output: Output.object({ schema: GeneratedDraft }),
      prompt: JSON.stringify({
        course: context.courseName,
        concept: { id: context.conceptId, name: context.conceptName, unit: context.unit, description: context.desc },
        sources: sourcePacket,
      }),
    });
    draft = GeneratedDraft.parse(result.output);
    validateReferences(draft, sources);
  } catch (error) {
    if (error instanceof LearningSpecGenerationError) throw error;
    throw new LearningSpecGenerationError("The model could not produce a valid course-grounded learning spec.", { cause: error });
  }

  const ids = misconceptionIds(draft.misconceptions.map((m) => m.name));
  const spec = {
    schemaVersion: 1 as const,
    courseId: context.courseId,
    conceptId: context.conceptId,
    revision,
    provenance: { kind: "generated" as const, model: modelLabel(), generatedAt: new Date().toISOString() },
    sources,
    assessment: draft.assessment,
    misconceptions: draft.misconceptions.map((m, i) => ({
      id: ids[i]!,
      name: m.name,
      description: m.description,
      clarificationQuestion: m.clarificationQuestion,
      sourceIds: m.sourceIds,
    })),
    remediations: draft.misconceptions.map((m, i) => ({
      misconceptionId: ids[i]!,
      title: m.remediation.title,
      actuallyTrue: m.remediation.actuallyTrue,
      explanation: m.remediation.explanation,
      sourceLabel: "From your course material",
      figure: null,
      sourceIds: m.remediation.sourceIds,
    })),
    transfer: draft.transfer,
    review: draft.review,
    skills: {
      onWrong: { label: draft.skillLabel, pct: 30 },
      onRight: { label: draft.skillLabel, pct: 85 },
    },
  };

  try {
    return ConceptLearningSpec.parse(spec);
  } catch {
    throw new LearningSpecGenerationError("The model produced learning content that failed the canonical spec contract.");
  }
}

/**
 * Returns authored content immediately, otherwise reuses a generated revision while its grounding material is unchanged.
 * If course material changes, a new immutable revision is generated and persisted for the current user.
 */
export async function ensureConceptLearningSpec(courseId: string, conceptId: string) {
  const authored = getAuthoredLearningSpec(courseId, conceptId);
  if (authored) return authored;

  const course = getCourse(courseId);
  const concept = course.concepts.find((c) => c.id === conceptId);
  if (!concept) throw new NotFoundError(`concept ${conceptId}`);

  const { sources, fingerprint } = grounding(courseId, concept.name, concept.desc);
  const current = getGeneratedLearningSpecRecord(courseId, conceptId);
  if (current?.fingerprint === fingerprint) return current.spec;
  if (!aiEnabled()) throw new LearningSpecGenerationError("Generating learning content for this course needs an AI key.");

  const revision = (current?.spec.revision ?? 0) + 1;
  const context: ConceptContext = {
    courseId,
    courseName: course.name,
    conceptId,
    conceptName: concept.name,
    unit: concept.unit,
    desc: concept.desc,
  };
  const generated = await generate(context, sources, revision);
  return saveGeneratedLearningSpec(generated, fingerprint);
}
