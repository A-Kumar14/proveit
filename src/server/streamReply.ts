import "server-only";
import { createTextStreamResponse, streamText, toTextStream, type ModelMessage } from "ai";
import { NextResponse } from "next/server";
import { model } from "./ai";
import { modelErrorMessage } from "./modelError";

/**
 * Streams a model reply as plain text. The model reports quota and overload by ending the stream with nothing,
 * so the first piece is read before answering, and an empty stream becomes a clear error instead of an empty 200.
 */
export async function streamReply(opts: { system: string; messages: ModelMessage[]; signal?: AbortSignal; fast?: boolean; failMessage: string }): Promise<Response> {
  let failure: unknown = null;
  const result = streamText({ model: model({ fast: opts.fast }), system: opts.system, messages: opts.messages, abortSignal: opts.signal, onError: ({ error }) => { failure = error; console.error(error); } });
  const reader = toTextStream({ stream: result.stream }).getReader();
  const first = await reader.read().catch(() => ({ done: true as const, value: undefined }));
  if (first.done || !first.value) return NextResponse.json({ error: modelErrorMessage(failure, opts.failMessage) }, { status: 502 });
  const stream = new ReadableStream<string>({
    start: (c) => c.enqueue(first.value),
    pull: async (c) => { const r = await reader.read(); if (r.done) c.close(); else c.enqueue(r.value); },
    cancel: (reason) => reader.cancel(reason),
  });
  return createTextStreamResponse({ stream });
}
