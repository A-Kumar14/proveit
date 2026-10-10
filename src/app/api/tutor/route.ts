import { createTextStreamResponse, streamText, toTextStream, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import { aiEnabled, model } from "@proveit/server/ai";
import { NotFoundError } from "@proveit/server/store";
import { parseTutorForm, tutorSystem } from "@proveit/server/tutor";

export const maxDuration = 60;

/** Streams the tutor's reply as plain text. Files go with the last message only. */
export async function POST(req: Request) {
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
  const result = streamText({ model: model(), system, messages, abortSignal: req.signal, onError: ({ error }) => console.error(error) });
  const reader = toTextStream({ stream: result.stream }).getReader();
  // The model reports quota and overload by ending the stream with nothing. Catch that before sending a 200.
  const first = await reader.read().catch(() => ({ done: true as const, value: undefined }));
  if (first.done || !first.value) return NextResponse.json({ error: "The tutor couldn't answer right now. The model may be busy or rate limited. Retry in a moment." }, { status: 502 });
  const stream = new ReadableStream<string>({
    start: (c) => c.enqueue(first.value),
    pull: async (c) => { const r = await reader.read(); if (r.done) c.close(); else c.enqueue(r.value); },
    cancel: (reason) => reader.cancel(reason),
  });
  return createTextStreamResponse({ stream });
}
