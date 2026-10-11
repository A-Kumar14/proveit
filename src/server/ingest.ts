import "server-only";
import type { CourseOutline } from "@proveit/lib/schemas";
import { aiEnabled } from "./ai";
import { parseCourseMd } from "./catalog";
import { outlineFromTexts } from "./courseUpload";
import { MaterialError, readMaterial, saveMaterial, type Material } from "./materials";
import { createCourse, EmptyOutlineError, type CourseFile } from "./store";

export type Source = { name: string; mime: string; size: number; text: string; readBy: Material["readBy"] };

/** Reads uploaded files into text sources. A file that can't be read is reported, not skipped silently. */
export async function readSources(files: File[]): Promise<{ sources: Source[]; failed: { name: string; reason: string }[] }> {
  const sources: Source[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const f of files) {
    try {
      const { text, readBy } = await readMaterial(f);
      sources.push({ name: f.name, mime: f.type, size: f.size, text, readBy });
    } catch (e) {
      if (e instanceof MaterialError) failed.push({ name: f.name, reason: e.message });
      else throw e;
    }
  }
  return { sources, failed };
}

const short = (name: string) => name.split(/\s+/).slice(0, 2).join(" ");

/** Markdown that already has ## units and ### concepts keeps its own structure. */
function outlineFromHeadings(name: string, text: string): CourseOutline | null {
  const spec = parseCourseMd(text, name, "import");
  if (!spec || spec.units.reduce((n, u) => n + u.concepts.length, 0) < 3) return null;
  return { units: spec.units.map((u) => ({ name: u.name, concepts: u.concepts.map((c) => ({ name: c.name, short: short(c.name), desc: c.desc })) })), prerequisites: [] };
}

/**
 * Builds a course from notes that are already text, such as notes pulled from a connected app. Headed markdown keeps its
 * structure. Anything else goes to the model, and without a key that is refused rather than guessed.
 */
export async function createCourseFromSources(name: string, sources: Source[], kindLabel: string): Promise<{ id: string; concepts: number }> {
  const title = name.trim();
  if (!title) throw new MaterialError("Give the course a name.");
  if (sources.length === 0) throw new MaterialError("Add at least one file with notes.");
  const combined = sources.map((s) => s.text).join("\n\n");
  let outline = outlineFromHeadings(title, combined);
  if (!outline) {
    if (!aiEnabled()) throw new MaterialError("I can't split plain notes into concepts without the AI, and no AI key is set. Use markdown with ## unit and ### concept headings, or add an AI key.");
    outline = await outlineFromTexts(title, sources.map((x) => ({ name: x.name, text: x.text }))).catch((e) => { if (e instanceof Error && e.constructor.name === "NotCourseMaterialError") throw new MaterialError(e.message); throw e; });
  }
  const record: CourseFile[] = sources.map((s) => ({ name: s.name, kind: `${kindLabel}, imported`, detail: "Notes pulled in from a connected app." }));
  let id: string;
  try {
    id = createCourse({ name: title, outline, files: record, rewardSource: sources.map(s => s.text).sort().join("\n\n") });
  } catch (e) {
    if (e instanceof EmptyOutlineError) throw new MaterialError("I couldn't find separate topics in those notes. Try adding more detail.");
    throw e;
  }
  for (const s of sources) saveMaterial(id, { name: s.name, mime: s.mime, size: s.size }, s.text, s.readBy);
  const concepts = outline.units.slice(0, 4).reduce((n, u) => n + Math.min(u.concepts.length, 3), 0);
  return { id, concepts };
}


