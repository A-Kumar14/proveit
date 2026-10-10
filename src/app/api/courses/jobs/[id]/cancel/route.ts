import { NextResponse } from "next/server";
import { cancelJob } from "@proveit/server/courseJobs";
import { withUserRoute } from "@proveit/server/userBoundary";

async function POSTForUser(_req: Request, ctx: RouteContext<"/api/courses/jobs/[id]/cancel">) {
  const { id } = await ctx.params;
  return NextResponse.json({ cancelled: cancelJob(id) });
}

export const POST = withUserRoute(POSTForUser);
