import { withUserRoute } from "@proveit/server/userBoundary";
import { type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import { aiEnabled } from "@proveit/server/ai";
import { streamReply } from "@proveit/server/streamReply";
import { NotFoundError } from "@proveit/server/store";
import { parseTutorForm, tutorSystem } from "@proveit/server/tutor";

export const maxDuration = 60;

/** Streams the tutor's reply as plain text. Files go with the last message only. */
async function POSTForUser(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const parsed = parseTutorForm(form);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!aiEnabled()) return NextResponse.json({ error: "The tutor needs GOOGLE_GENERATIVE_AI_API_KEY on the server." }, { status: 501 });

  let system: string;
  try {
    system = tutorSystem(parsed.courseId);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }
  const last = parsed.messages.length - 1;
  const messages: ModelMessage[] = await Promise.all(parsed.messages.map(async (m, i): Promise<ModelMessage> => {
    if (m.role === "assistant") return { role: "assistant", content: m.text };
    if (i !== last || parsed.files.length === 0) return { role: "user", content: m.text };
    const files = await Promise.all(parsed.files.map(async (f) => ({ type: "file" as const, data: new Uint8Array(await f.arrayBuffer()), mediaType: f.type })));
    return { role: "user", content: [{ type: "text", text: m.text }, ...files] };
  }));
  return streamReply({ system, messages, signal: req.signal, failMessage: "The tutor couldn't answer right now. The model may be busy or rate limited. Retry in a moment." });
}

export const POST = withUserRoute(POSTForUser);
