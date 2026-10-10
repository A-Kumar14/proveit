import { withUserRoute } from "@proveit/server/userBoundary";
import { NextResponse } from "next/server";
import { aiEnabled } from "@proveit/server/ai";
import { sessionSystem } from "@proveit/server/session";
import { NotFoundError } from "@proveit/server/store";
import { streamReply } from "@proveit/server/streamReply";
import { parseTutorForm } from "@proveit/server/tutor";

export const maxDuration = 60;

/**
 * One turn of a tutoring conversation about a concept: the tutor reacts to what the student said, corrects or agrees,
 * teaches when asked, and asks the next question. It streams plain text, never grades, and never changes mastery.
 * Only the student's own words and the tutor's earlier replies come from the browser.
 */
async function POSTForUser(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const parsed = parseTutorForm(form);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const conceptId = form.get("conceptId");
  if (typeof conceptId !== "string" || !conceptId) return NextResponse.json({ error: "Missing concept." }, { status: 400 });
  if (!aiEnabled()) return NextResponse.json({ error: "The tutor session needs an AI key on the server (OPENROUTER_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)." }, { status: 501 });

  let system: string;
  try {
    system = sessionSystem(parsed.courseId, conceptId);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }
  return streamReply({
    system, signal: req.signal, fast: true,
    messages: parsed.messages.map((m) => ({ role: m.role, content: m.text })),
    failMessage: "Your tutor couldn't answer right now. The model may be busy or rate limited. Retry in a moment.",
  });
}

export const POST = withUserRoute(POSTForUser);
