import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { CalendarError } from "./calendar";
import { InvalidAttemptLinkError, NotFoundError, TaskLockedError } from "./store";

/** Shared body for the POST handlers: parse with zod, map known errors to JSON. */
export async function handle<S extends z.ZodType, R>(req: Request, schema: S, run: (input: z.infer<S>) => R | Promise<R>) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  try {
    return NextResponse.json(await run(parsed.data));
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (e instanceof CalendarError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof TaskLockedError) return NextResponse.json({ error: e.message }, { status: 409 });
    if (e instanceof InvalidAttemptLinkError) return NextResponse.json({ error: "That follow-up no longer matches this learning attempt. Restart the question." }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: "The evaluator failed. Retry." }, { status: 500 });
  }
}
