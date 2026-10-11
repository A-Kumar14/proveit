import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { CourseOutline } from "@proveit/lib/schemas";
import { model } from "./ai";
import { documentKind } from "./documentText";
import { MAX_PER_UNIT, MAX_UNITS } from "./store";

/** "document" is Word, PowerPoint, Excel, HTML or CSV. The route turns it into text before anything reads it. */
export type UploadKind = "pdf" | "text" | "image" | "document";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Gemini takes inline files up to about 20 MB per request. */
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Browsers often send .md files with an empty type, so the extension decides when the type is missing. */
export function kindOf(file: File): UploadKind | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (file.type === "application/pdf" || (!file.type && ext === "pdf")) return "pdf";
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (file.type === "text/plain" || file.type === "text/markdown" || ((!file.type || file.type === "application/octet-stream") && (ext === "md" || ext === "txt"))) return "text";
  if (documentKind(file)) return "document";
  return null;
}

export class NotCourseMaterialError extends Error {}

// ---- outline parser (no model key) ----

const HEADING = /^#{1,4}\s+(.+)$/;
const UNIT_LINE = /^(?:unit|week|module|chapter|part|topic|lecture)\s*\d+\s*[:.)\-–—]?\s*(.*)$/i;
const BULLET = /^(?:[-*•+]|\d+[.)])\s+(.+)$/;
/** Syllabus admin, not concepts. */
const ADMIN = /\b(grading|grades?|office hours|attendance|textbook|syllabus|midterm|final exam|exams?|homework|policy|policies|schedule|contact|instructor|late work|due dates?|course info|logistics|prerequisites?)\b/i;

const tidy = (s: string) => s.replace(/[*_`]+/g, "").replace(/\s+/g, " ").trim();

/**
 * Reads a plain-text or Markdown outline: headings and "Week 3:" lines start a unit, bullets under them are concepts.
 * It invents no prerequisites, because list order alone does not show that one idea depends on another.
 */
export function outlineFromText(text: string): CourseOutline {
  const units: CourseOutline["units"] = [];
  let current: CourseOutline["units"][number] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADING.exec(line)?.[1] ?? (UNIT_LINE.test(line) && !BULLET.test(line) ? line : null);
    if (heading) {
      const name = tidy(UNIT_LINE.exec(tidy(heading))?.[1] || heading);
      current = ADMIN.test(name) ? null : { name, concepts: [] };
      if (current) units.push(current);
      continue;
    }
    const item = BULLET.exec(line)?.[1];
    if (!item) continue;
    if (!current) units.push((current = { name: "Topics", concepts: [] }));
    const [name = "", ...rest] = tidy(item).split(/\s*(?::|\s[-–—]\s)\s*/);
    if (!name || ADMIN.test(name) || current.concepts.length >= MAX_PER_UNIT) continue;
    current.concepts.push({
      name,
      short: name.split(/\s+/).slice(0, 2).join(" "),
      desc: rest.join(": ") || `Explain ${name.toLowerCase()} in your own words and apply it to a new example.`,
    });
  }
  return { units: units.filter((u) => u.concepts.length > 0).slice(0, MAX_UNITS), prerequisites: [] };
}

// ---- model extraction ----

const Extraction = CourseOutline.extend({
  isCourseMaterial: z.boolean().describe("False when the files are not material for a course a student studies, such as receipts, random photos or blank pages."),
  reason: z.string().describe("One short sentence. Why the files are or are not course material."),
});

/** By the time a file reaches the model, documents are already text. */
export type UploadFile = { name: string; kind: Exclude<UploadKind, "document">; mediaType: string; data: Uint8Array };

const instructions = (courseName: string) => `A student uploaded these files to build a study course called "${courseName}".
Build the concept map a tutor would test them on.
- Return ${MAX_UNITS} or fewer units in teaching order, each with at most ${MAX_PER_UNIT} concepts. At most ${MAX_UNITS * MAX_PER_UNIT} concepts in total, so keep the core ideas a student must be able to explain.
- A concept is one testable idea, not a chapter title and not admin (grading, dates, policies, contact details).
- prerequisites: add one only when "to" cannot be understood without "from". "from" must be in the same or an earlier unit. Use the exact concept names. Do not add links just to connect the map.
- Use only what the files cover. Do not add topics from outside them.`;

/** Gemini reads PDFs, images and text directly, so no PDF parsing dependency is needed. */
export async function extractOutline(courseName: string, files: UploadFile[]): Promise<CourseOutline> {
  const decoder = new TextDecoder();
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: Extraction }),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: instructions(courseName) },
        ...files.map((f) => f.kind === "text"
          ? { type: "text" as const, text: `File "${f.name}":\n${decoder.decode(f.data)}` }
          : { type: "file" as const, data: f.data, mediaType: f.mediaType }),
      ],
    }],
  });
  if (!output.isCourseMaterial) throw new NotCourseMaterialError(output.reason || "Those files don't look like course material.");
  return { units: output.units, prerequisites: output.prerequisites };
}

/** Most text sent to the model in one go. Gemini could take more, but a bigger prompt only makes it slower. */
export const OUTLINE_CHAR_BUDGET = 300_000;
/** A model call that takes longer than this has stalled, and the student should hear about it. */
export const OUTLINE_TIMEOUT_MS = 120_000;

/**
 * Builds the outline from text we already extracted, so the model reads plain text and not whole PDFs.
 * Each file gets an equal share of the budget, taken from its start, where contents and headings sit.
 */
export async function outlineFromTexts(courseName: string, docs: { name: string; text: string }[]): Promise<CourseOutline> {
  const share = Math.max(15_000, Math.floor(OUTLINE_CHAR_BUDGET / Math.max(1, docs.length)));
  const { output } = await generateText({
    model: model({ fast: true }),
    output: Output.object({ schema: Extraction }),
    abortSignal: AbortSignal.timeout(OUTLINE_TIMEOUT_MS),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: instructions(courseName) },
        ...docs.map((d) => ({ type: "text" as const, text: `File "${d.name}":\n${d.text.slice(0, share)}` })),
      ],
    }],
  });
  if (!output.isCourseMaterial) throw new NotCourseMaterialError(output.reason || "Those files don't look like course material.");
  return { units: output.units, prerequisites: output.prerequisites };
}
