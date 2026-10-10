import { withUserRoute } from "@proveit/server/userBoundary";
import { NextResponse } from "next/server";
import { modelErrorMessage } from "@proveit/server/modelError";
import { addMaterial, MAX_MATERIAL_FILES, MaterialError } from "@proveit/server/materials";
import { NotFoundError } from "@proveit/server/store";
import type { FileUploadResult } from "@proveit/lib/schemas";

export const maxDuration = 120;

/** Adds files to a course as study context. Each file succeeds or fails on its own. */
async function POSTForUser(req: Request) {
  const form = await req.formData().catch(() => null);
  const courseId = form?.get("courseId");
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (typeof courseId !== "string" || !courseId) return NextResponse.json({ error: "Missing course." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
  if (files.length > MAX_MATERIAL_FILES) return NextResponse.json({ error: `Add up to ${MAX_MATERIAL_FILES} files at a time.` }, { status: 400 });
  const result: FileUploadResult = { added: [], failed: [] };
  for (const file of files) {
    try {
      const m = await addMaterial(courseId, file);
      result.added.push({ id: m.id, name: m.name, words: m.words, readBy: m.readBy });
    } catch (e) {
      if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
      if (e instanceof MaterialError) { result.failed.push({ name: file.name, reason: e.message }); continue; }
      console.error(e);
      result.failed.push({ name: file.name, reason: modelErrorMessage(e, `I couldn't read ${file.name}. Retry.`) });
    }
  }
  return NextResponse.json(result);
}

export const POST = withUserRoute(POSTForUser);
