import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserRoute } from "@proveit/server/userBoundary";
import { removeCatalogCourse } from "@proveit/server/courses";

const Body = z.object({ courseId: z.string().min(1).max(100) });

/** Deletes a course with its files, generated content and quizzes. The main built-in course can't be deleted. */
export const POST = withUserRoute(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick a course." }, { status: 400 });
  const { removed } = removeCatalogCourse(parsed.data.courseId);
  if (!removed) return NextResponse.json({ error: "That course can't be deleted." }, { status: 404 });
  return NextResponse.json({ removed: true });
});
