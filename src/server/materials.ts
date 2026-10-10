import "server-only";
import { generateText } from "ai";
import { aiEnabled, model } from "./ai";
import { AUTHORED } from "./content";
import { loadJson, saveJson } from "./persistence";
import { courseSpec, getCourse } from "./store";

export type Material = { id: string; courseId: string; name: string; mime: string; size: number; addedAt: number; text: string; words: number; readBy: "text" | "ai" };

export class MaterialError extends Error {}

export const MATERIAL_TYPES = ["text/markdown", "text/plain", "application/pdf", "image/png", "image/jpeg", "image/webp"];
export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;
export const MAX_MATERIAL_FILES = 5;
const MAX_TEXT = 60_000;
const KEY = "materials";

type Held = { items: Material[]; seq: number };
const g = globalThis as unknown as { __proveitMaterials?: Held };
const held = (): Held => (g.__proveitMaterials ??= { items: loadJson<Material[]>(KEY) ?? [], seq: 0 });
const save = () => saveJson(KEY, held().items);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const isText = (f: { name: string; type: string }) => f.type === "text/markdown" || f.type === "text/plain" || /\.(md|markdown|txt)$/i.test(f.name);

/** Browsers often send an empty or generic type for .md files, so the extension decides for text. */
export function materialKind(f: { name: string; type: string }): "text" | "pdf" | "image" | null {
  if (isText(f)) return "text";
  if (f.type === "application/pdf") return "pdf";
  if (["image/png", "image/jpeg", "image/webp"].includes(f.type)) return "image";
  return null;
}

async function readWithAi(file: File): Promise<string> {
  if (!aiEnabled()) throw new MaterialError(`${file.name} needs the AI to read it, and no AI key is set. Add a markdown or text file instead.`);
  const { text } = await generateText({
    model: model(),
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Transcribe the study content in this file as plain text. Keep headings and lists as simple markdown. Copy faithfully, do not summarise or add commentary. If it contains no readable study content, reply with exactly NO_CONTENT." },
        { type: "file", data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type },
      ],
    }],
  });
  return text;
}

export function listMaterials(courseId: string): Material[] {
  return held().items.filter((m) => m.courseId === courseId).sort((a, b) => b.addedAt - a.addedAt);
}

/** Reads one uploaded file into the course. Text files are read as is, PDFs and images by the model. */
export async function addMaterial(courseId: string, file: File): Promise<Material> {
  getCourse(courseId);
  const kind = materialKind(file);
  if (!kind) throw new MaterialError(`${file.name} isn't supported. Use markdown, text, PDF or an image.`);
  if (file.size > MAX_MATERIAL_BYTES) throw new MaterialError(`${file.name} is over 10 MB.`);
  const raw = kind === "text" ? await file.text() : await readWithAi(file);
  const text = raw.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT);
  if (!text || text === "NO_CONTENT") throw new MaterialError(`I couldn't find any study text in ${file.name}.`);
  const h = held();
  const m: Material = { id: `m${Date.now().toString(36)}${(++h.seq).toString(36)}`, courseId, name: file.name.slice(0, 200), mime: file.type || "text/plain", size: file.size, addedAt: Date.now(), text, words: words(text), readBy: kind === "text" ? "text" : "ai" };
  h.items.push(m);
  save();
  return m;
}

export function removeMaterial(courseId: string, id: string): boolean {
  getCourse(courseId);
  const h = held();
  const i = h.items.findIndex((m) => m.id === id && m.courseId === courseId);
  if (i < 0) return false;
  h.items.splice(i, 1);
  save();
  return true;
}

/** Authored notes for courses that have them, such as the demo statistics course. */
function authoredNotes(courseId: string): string {
  return getCourse(courseId).concepts.flatMap((c) => {
    const a = AUTHORED[c.id];
    return a ? [`## ${c.name}\n${a.correct}\n${a.lesson.actuallyTrue} ${a.lesson.explanation}`] : [];
  }).join("\n\n");
}

/**
 * Everything the course knows, as one block of text: the notes it was built from, the lesson content we wrote
 * for it, and the files the student uploaded. Capped so a prompt can't grow without limit.
 */
export function courseMaterial(courseId: string, budget = 24_000): string {
  const parts: string[] = [];
  const spec = courseSpec(courseId);
  if (spec) parts.push(`# Course notes\n${spec.material}`);
  const authored = authoredNotes(courseId);
  if (authored) parts.push(`# Course notes\n${authored}`);
  for (const m of listMaterials(courseId)) parts.push(`# Uploaded file: ${m.name}\n${m.text}`);
  const all = parts.join("\n\n");
  return all.length > budget ? `${all.slice(0, budget)}\n[...cut for length]` : all;
}

