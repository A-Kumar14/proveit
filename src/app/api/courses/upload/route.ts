import { after, NextResponse } from "next/server";
import { createJob, runCourseJob, type JobInput } from "@proveit/server/courseJobs";
import { kindOf, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@proveit/server/courseUpload";
import { withUserRoute } from "@proveit/server/userBoundary";
import { aiEnabled } from "@proveit/server/ai";
import { documentText, isLegacyOffice, UnreadableDocumentError } from "@proveit/server/documentText";

export const maxDuration = 300;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Starts building a course from uploaded syllabus, slides or notes, and answers at once with a job id.
 * The build runs after the response, and the browser follows it at /api/courses/jobs/[id].
 * Typeset PDFs and text are read on this machine. The model only reads scans and images, and writes the outline.
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

  for (const f of raw) {
    if (!kindOf(f)) return bad(isLegacyOffice(f.name) ? `${f.name} is an old Office format. Save it as .docx, .pptx or .xlsx and try again.` : `${f.name}: use PDF, TXT, Markdown, Word, PowerPoint, Excel, HTML, CSV, PNG, JPEG or WebP.`);
    if (f.size > MAX_FILE_BYTES) return bad(`${f.name} is over 10 MB.`);
  }
  if (raw.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) return bad("Files can be up to 20 MB together.");
  // Scans and images need the model. Typeset PDFs do not, so they are still allowed with no key.
  if (!aiEnabled() && raw.some((f) => kindOf(f) === "image")) return bad("Reading images needs an AI key on the server (OPENROUTER_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY). Upload a PDF, TXT or Markdown file instead.", 501);

  // Office, HTML and CSV files become plain text here, so the build treats them like notes.
  let inputs: JobInput[];
  try {
    inputs = await Promise.all(raw.map(async (f) => {
      if (kindOf(f) !== "document") return { name: f.name, type: f.type || (kindOf(f) === "pdf" ? "application/pdf" : "text/plain"), size: f.size, bytes: new Uint8Array(await f.arrayBuffer()) };
      const text = await documentText(f);
      if (!text.trim()) throw new UnreadableDocumentError(`I couldn't find any text in ${f.name}.`);
      const bytes = new TextEncoder().encode(text);
      return { name: f.name, type: "text/plain", size: bytes.length, bytes };
    }));
  } catch (e) {
    if (e instanceof UnreadableDocumentError) return bad(e.message);
    throw e;
  }
  const jobId = createJob(name, inputs);
  // The build runs after this response, so it carries the user it belongs to.
  after(() => runCourseJob(jobId, inputs));
  return NextResponse.json({ jobId }, { status: 202 });
}

export const POST = withUserRoute(POSTForUser);
