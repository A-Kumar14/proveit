import { withUserRoute } from "@proveit/server/userBoundary";
import { NextResponse } from "next/server";
import { aiEnabled } from "@proveit/server/ai";
import { extractOutline, kindOf, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, NotCourseMaterialError, outlineFromText, type UploadFile } from "@proveit/server/courseUpload";
import { DOCUMENT_LABEL, documentKind, documentText, isLegacyOffice, UnreadableDocumentError } from "@proveit/server/documentText";
import { saveUploadsAsMaterials } from "@proveit/server/materials";
import { createCourse, EmptyOutlineError, type CourseFile } from "@proveit/server/store";

export const maxDuration = 60;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const KIND_LABEL = { pdf: "PDF", text: "Notes", image: "Image" } as const;

/**
 * Builds a new course from uploaded syllabus, slides or notes. With a model key Gemini reads every file.
 * Without one, text, Markdown, Word, PowerPoint, Excel, HTML and CSV work, parsed from their headings and bullets.
 * Office, HTML and CSV files are turned into text here either way, because the model can't read them directly.
 */
async function POSTForUser(req: Request) {
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
  const labels: string[] = [];
  for (const f of raw) {
    const kind = kindOf(f);
    if (!kind) return bad(isLegacyOffice(f.name)
      ? `${f.name} is an old Office format. Save it as .docx, .pptx or .xlsx and try again.`
      : `${f.name}: use PDF, TXT, Markdown, Word, PowerPoint, Excel, HTML, CSV, PNG, JPEG or WebP.`);
    if (f.size > MAX_FILE_BYTES) return bad(`${f.name} is over 10 MB.`);
    if (kind === "document") {
      let text: string;
      try { text = await documentText(f); }
      catch (e) { if (e instanceof UnreadableDocumentError) return bad(e.message); throw e; }
      if (!text.trim()) return bad(`I couldn't find any text in ${f.name}.`);
      files.push({ name: f.name, kind: "text", mediaType: "text/plain", data: new TextEncoder().encode(text) });
      labels.push(DOCUMENT_LABEL[documentKind(f)!]);
    } else {
      files.push({ name: f.name, kind, mediaType: kind === "text" ? "text/plain" : f.type || "application/pdf", data: new Uint8Array(await f.arrayBuffer()) });
      labels.push(KIND_LABEL[kind]);
    }
  }
  if (raw.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return bad("Files can be up to 20 MB together.");

  const ai = aiEnabled();
  if (!ai && files.some((f) => f.kind !== "text")) return bad("Reading PDFs and images needs an AI key on the server (OPENROUTER_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY). Upload text, Markdown, Word, PowerPoint, Excel, HTML or CSV instead.", 501);

  try {
    const outline = ai
      ? await extractOutline(name, files)
      : outlineFromText(files.map((f) => new TextDecoder().decode(f.data)).join("\n\n"));
    const record: CourseFile[] = files.map((f, i) => ({
      name: f.name, kind: `${labels[i]}, uploaded`,
      detail: ai ? "Read by Gemini to build the concept map." : "Headings and bullets became the units and concepts.",
    }));
    const courseId = createCourse({ name, outline, files: record });
    // Keep the notes as files of the course, so the tutor, notes, paper and quiz can use them.
    await saveUploadsAsMaterials(courseId, raw);
    return NextResponse.json({ courseId });
  } catch (e) {
    if (e instanceof NotCourseMaterialError) return bad(e.message, 422);
    if (e instanceof EmptyOutlineError) return bad(ai ? "No concepts found in those files. Try the syllabus or lecture notes." : "No concepts found. Use headings for units and bullets for concepts.", 422);
    console.error(e);
    return bad("Building the concept map failed. Retry.", 500);
  }
}

export const POST = withUserRoute(POSTForUser);
