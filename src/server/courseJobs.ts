import "server-only";
import { randomUUID } from "node:crypto";
import type { CourseJobView } from "@proveit/lib/schemas";
import { aiEnabled } from "./ai";
import { NotCourseMaterialError, outlineFromText, outlineFromTexts } from "./courseUpload";
import { MaterialError, readMaterial, saveMaterial, type Material } from "./materials";
import { modelErrorMessage } from "./modelError";
import { loadJson, saveJson } from "./persistence";
import { createCourse, EmptyOutlineError, type CourseFile } from "./store";
import { runAsUser, scopedUserId } from "./userScope";

/** The stages a build goes through, in order. The student sees these. */
export const STAGES = [
  { id: "reading", label: "Reading your files" },
  { id: "outline", label: "Finding the topics" },
  { id: "building", label: "Building the concept map" },
  { id: "saving", label: "Saving your notes for the tutor" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

type FileState = { name: string; state: "waiting" | "reading" | "done" | "failed"; note?: string };
type Job = {
  id: string; /** Who started it. Only they can follow or cancel it. */ userId: string; name: string; stage: StageId | "done" | "failed" | "cancelled"; files: FileState[];
  startedAt: number; updatedAt: number; endedAt?: number; courseId?: string; error?: string; concepts?: number;
  /** The stage a failed or cancelled build stopped in. */ stoppedAt?: StageId;
};
export type JobInput = { name: string; type: string; size: number; bytes: Uint8Array };

const READ_CONCURRENCY = 4;
/** A job that has not moved for this long was lost, for example when the server restarted mid-build. */
const STALE_MS = 6 * 60 * 1000;
const key = (id: string) => `job:${id}`;

// Kept in memory too, so jobs still work where persistence is off.
const g = globalThis as unknown as { __proveitJobs?: Map<string, Job> };
const jobs = () => (g.__proveitJobs ??= new Map<string, Job>());

function save(job: Job) {
  job.updatedAt = Date.now();
  jobs().set(job.id, job);
  saveJson(key(job.id), job);
}
const load = (id: string): Job | null => loadJson<Job>(key(id)) ?? jobs().get(id) ?? null;
/** A job the current user doesn't own looks like it doesn't exist. */
const mine = (id: string): Job | null => { const j = load(id); return j && j.userId === scopedUserId() ? j : null; };

export function getJob(id: string): CourseJobView | null {
  let job = mine(id);
  if (!job) return null;
  const over = job.stage === "done" || job.stage === "failed" || job.stage === "cancelled";
  if (!over && Date.now() - job.updatedAt > STALE_MS) {
    job = { ...job, stoppedAt: job.stage as StageId, stage: "failed", error: "The build stopped, probably because the server restarted. Try again.", endedAt: Date.now() };
  }
  const order: string[] = STAGES.map((s) => s.id);
  const current = order.indexOf(job.stage === "failed" || job.stage === "cancelled" ? job.stoppedAt ?? "reading" : job.stage);
  return {
    id: job.id, name: job.name, stage: job.stage,
    stages: STAGES.map((s, i) => ({
      id: s.id, label: s.label,
      state: job.stage === "done" || i < current ? "done" : i > current ? "waiting" : job.stage === "failed" || job.stage === "cancelled" ? "failed" : "active",
    })),
    files: job.files, courseId: job.courseId, error: job.error, concepts: job.concepts,
    elapsedMs: (job.endedAt ?? Date.now()) - job.startedAt,
  };
}

export function cancelJob(id: string): boolean {
  const job = mine(id);
  if (!job || job.stage === "done" || job.stage === "failed" || job.stage === "cancelled") return false;
  save({ ...job, stoppedAt: job.stage, stage: "cancelled", endedAt: Date.now() });
  return true;
}
const cancelled = (id: string) => load(id)?.stage === "cancelled";

export function createJob(name: string, files: JobInput[]): string {
  const id = randomUUID();
  save({ id, userId: scopedUserId(), name, stage: "reading", files: files.map((f) => ({ name: f.name, state: "waiting" })), startedAt: Date.now(), updatedAt: Date.now() });
  return id;
}

async function pool<T>(items: T[], size: number, run: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; await run(items[i]!, i); }
  }));
}

class Stop extends Error {}

/**
 * Runs the whole build. Each stage updates the job, so the student sees where it is.
 * Reading is local for typeset PDFs and text, and the model only reads scans and images, a few at a time.
 */
export async function runCourseJob(id: string, inputs: JobInput[]): Promise<void> {
  const owner = load(id)?.userId;
  if (!owner) return;
  return runAsUser(owner, () => buildCourse(id, inputs));
}

async function buildCourse(id: string, inputs: JobInput[]): Promise<void> {
  const at = (stage: StageId) => { const j = load(id); if (j && j.stage !== "cancelled") save({ ...j, stage }); if (cancelled(id)) throw new Stop(); };
  try {
    const job = load(id)!;
    at("reading");
    const read: { name: string; mime: string; size: number; text: string; readBy: Material["readBy"] }[] = [];
    const update = (i: number, patch: Partial<FileState>) => { const j = load(id)!; j.files[i] = { ...j.files[i]!, ...patch }; save(j); };
    await pool(inputs, READ_CONCURRENCY, async (f, i) => {
      if (cancelled(id)) throw new Stop();
      update(i, { state: "reading" });
      try {
        const file = new File([f.bytes as BlobPart], f.name, { type: f.type });
        const { text, readBy } = await readMaterial(file);
        read.push({ name: f.name, mime: f.type, size: f.size, text, readBy });
        update(i, { state: "done", note: readBy === "ai" ? "Read by the AI" : `${text.split(/\s+/).length.toLocaleString("en-US")} words` });
      } catch (e) {
        update(i, { state: "failed", note: e instanceof MaterialError ? e.message : modelErrorMessage(e, `Couldn't read ${f.name}.`) });
      }
    });
    if (read.length === 0) throw new MaterialError(load(id)!.files.find((f) => f.state === "failed")?.note ?? "I couldn't read any of those files.");

    at("outline");
    const outline = aiEnabled()
      ? await outlineFromTexts(job.name, read.map((r) => ({ name: r.name, text: r.text })))
      : outlineFromText(read.map((r) => r.text).join("\n\n"));

    at("building");
    const record: CourseFile[] = read.map((r) => ({ name: r.name, kind: `${r.mime === "application/pdf" ? "PDF" : r.mime.startsWith("image/") ? "Image" : "Notes"}, uploaded`, detail: r.readBy === "ai" ? "Read by the AI to build the concept map." : "Read to build the concept map." }));
    const courseId = createCourse({ name: job.name, outline, files: record });

    at("saving");
    for (const r of read) saveMaterial(courseId, { name: r.name, mime: r.mime, size: r.size }, r.text, r.readBy);
    const done = load(id)!;
    save({ ...done, stage: "done", courseId, concepts: outline.units.reduce((n, u) => n + u.concepts.length, 0), endedAt: Date.now() });
  } catch (e) {
    if (e instanceof Stop) return;
    const j = load(id);
    if (!j || j.stage === "cancelled") return;
    let error: string;
    if (e instanceof NotCourseMaterialError || e instanceof MaterialError) error = e.message;
    else if (e instanceof EmptyOutlineError) error = aiEnabled() ? "No concepts found in those files. Try the syllabus or lecture notes." : "No concepts found. Use headings for units and bullets for concepts.";
    else if (e instanceof Error && e.name === "TimeoutError") error = "The AI took too long to answer. Try again, or add fewer files.";
    else { console.error(e); error = modelErrorMessage(e, "Building the concept map failed. Try again."); }
    save({ ...j, stoppedAt: j.stage as StageId, stage: "failed", error, endedAt: Date.now() });
  }
}
