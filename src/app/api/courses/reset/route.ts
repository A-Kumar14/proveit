import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserRoute } from "@proveit/server/userBoundary";
import { NotFoundError, resetCourseProgress } from "@proveit/server/store";

const Body = z.object({ courseId: z.string().min(1).max(100) });

/** Starts one course over. The browser asks the student to type the course name first. */
export const POST = withUserRoute(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a course." }, { status: 400 });
  try { resetCourseProgress(parsed.data.courseId); }
  catch (e) { if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 }); throw e; }
  return NextResponse.json({ ok: true });
});
