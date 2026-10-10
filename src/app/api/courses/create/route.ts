import { NextResponse } from "next/server";
import { createCourse, readSources } from "@proveit/server/ingest";
import { MAX_MATERIAL_FILES, MaterialError } from "@proveit/server/materials";
import { modelErrorMessage } from "@proveit/server/modelError";

export const maxDuration = 180;

/** Builds a course from uploaded notes: a name and up to five files. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const name = form?.get("name");
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Give the course a name." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "Add at least one file with notes." }, { status: 400 });
  if (files.length > MAX_MATERIAL_FILES) return NextResponse.json({ error: `Add up to ${MAX_MATERIAL_FILES} files.` }, { status: 400 });
  try {
    const { sources, failed } = await readSources(files);
    if (sources.length === 0) return NextResponse.json({ error: failed[0]?.reason ?? "I couldn't read those files." }, { status: 400 });
    const made = await createCourse(name, sources, "upload");
    return NextResponse.json({ ...made, failed });
  } catch (e) {
    if (e instanceof MaterialError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: modelErrorMessage(e, "Couldn't build the course. Retry.") }, { status: 500 });
  }
}
