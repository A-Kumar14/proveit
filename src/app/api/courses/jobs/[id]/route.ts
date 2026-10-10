import { NextResponse } from "next/server";
import { getJob } from "@proveit/server/courseJobs";
import { withUserRoute } from "@proveit/server/userBoundary";

export const dynamic = "force-dynamic";

async function GETForUser(_req: Request, ctx: RouteContext<"/api/courses/jobs/[id]">) {
  const { id } = await ctx.params;
  const job = getJob(id);
  return job ? NextResponse.json(job) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export const GET = withUserRoute(GETForUser);
