import { NextResponse } from "next/server";
import { cancelJob } from "@proveit/server/courseJobs";

export async function POST(_req: Request, ctx: RouteContext<"/api/courses/jobs/[id]/cancel">) {
  const { id } = await ctx.params;
  return NextResponse.json({ cancelled: cancelJob(id) });
}
