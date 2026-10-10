import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { CalendarError } from "./calendar";
import { MaterialError } from "./materials";
import { modelErrorMessage, UpstreamError } from "./modelError";
import { InvalidAttemptLinkError, NotFoundError, ReviewNotDueError, TaskLockedError } from "./store";

/** Shared body for the POST handlers: parse with zod, map known errors to JSON. */
export async function handle<S extends z.ZodType, R>(req: Request, schema: S, run: (input: z.infer<S>, req: Request) => R | Promise<R>) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json(await run(parsed.data, req));
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (e instanceof UpstreamError) return NextResponse.json({ error: e.message }, { status: 502 });
    if (e instanceof MaterialError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof CalendarError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof TaskLockedError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof ReviewNotDueError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof InvalidAttemptLinkError) return NextResponse.json({ error: "That learning step is no longer current. Refresh or restart the question." }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: modelErrorMessage(e, "The evaluator failed. Retry.") }, { status: 500 });
  }
}
