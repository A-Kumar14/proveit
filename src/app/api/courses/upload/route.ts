import { NextResponse } from "next/server";
import { aiEnabled } from "@proveit/server/ai";
import { extractOutline, kindOf, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, NotCourseMaterialError, outlineFromText, type UploadFile } from "@proveit/server/courseUpload";
import { createCourse, EmptyOutlineError, type CourseFile } from "@proveit/server/store";

export const maxDuration = 60;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const KIND_LABEL = { pdf: "PDF", text: "Notes", image: "Image" } as const;

/**
 * Builds a new course from uploaded syllabus, slides or notes. With a model key Gemini reads every file.
 * Without one, only .txt and .md outlines work, parsed from their headings and bullets.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return bad("Invalid request.");
  const name = String(form.get("name") ?? "").trim();
  const raw = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!name) return bad("Name the course first.");
  if (name.length > 80) return bad("Keep the course name under 80 characters.");
  if (form.get("rights") !== "1") return bad("Confirm you have the right to use these files.");
  if (raw.length === 0) return bad("Add at least one file.");
  if (raw.length > MAX_FILES) return bad(`Add up to ${MAX_FILES} files.`);

  const files: UploadFile[] = [];
  for (const f of raw) {
    const kind = kindOf(f);
    if (!kind) return bad(`${f.name}: use PDF, TXT, Markdown, PNG, JPEG or WebP.`);
    if (f.size > MAX_FILE_BYTES) return bad(`${f.name} is over 10 MB.`);
    files.push({ name: f.name, kind, mediaType: kind === "text" ? "text/plain" : f.type || "application/pdf", data: new Uint8Array(await f.arrayBuffer()) });
  }
  if (raw.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return bad("Files can be up to 20 MB together.");

  const ai = aiEnabled();
  if (!ai && files.some((f) => f.kind !== "text")) return bad("Reading PDFs and images needs GOOGLE_GENERATIVE_AI_API_KEY on the server. Upload a .txt or .md outline instead.", 501);

  try {
    const outline = ai
      ? await extractOutline(name, files)
      : outlineFromText(files.map((f) => new TextDecoder().decode(f.data)).join("\n\n"));
    const record: CourseFile[] = files.map((f) => ({
      name: f.name, kind: `${KIND_LABEL[f.kind]}, uploaded`,
      detail: ai ? "Read by Gemini to build the concept map." : "Headings and bullets became the units and concepts.",
    }));
    return NextResponse.json({ courseId: createCourse({ name, outline, files: record }) });
  } catch (e) {
    if (e instanceof NotCourseMaterialError) return bad(e.message, 422);
    if (e instanceof EmptyOutlineError) return bad(ai ? "No concepts found in those files. Try the syllabus or lecture notes." : "No concepts found. Use headings for units and bullets for concepts.", 422);
    console.error(e);
    return bad("Building the concept map failed. Retry.", 500);
  }
}
