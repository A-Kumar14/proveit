import { createTextStreamResponse, Output, streamText, toTextStream } from "ai";
import { NextResponse } from "next/server";
import { ReviewInput, ReviewText } from "@proveit/lib/schemas";
import { aiEnabled, model } from "@proveit/server/ai";
import { getReviewBase, NotFoundError } from "@proveit/server/store";

export const maxDuration = 60;

const SYSTEM = `You write the text fields of a student's mastery review.
- Use only the facts given. Do not invent concepts, numbers or misconceptions.
- Write one entry in "misconceptions" per fact, in the same order, copying the concept name. Use null when the fact has no misconception.
- Plain, short sentences. No praise, no emoji.
- nextActions has 1 or 2 imperative sentences.`;

export async function POST(req: Request) {
  const parsed = ReviewInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let base;
  try {
    base = getReviewBase(parsed.data.courseId);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }
  // Without a key the same JSON shape comes back as plain text, so the card renders the same way.
  if (!aiEnabled()) return new Response(JSON.stringify(base.fallback), { headers: { "content-type": "text/plain; charset=utf-8" } });

  const result = streamText({
    model: model(),
    system: SYSTEM,
    output: Output.object({ schema: ReviewText }),
    prompt: `Headline: ${base.headline}\nBiggest risk concept: ${base.riskConcept ?? "none"}\nFacts: ${JSON.stringify(base.facts)}\nConcept table: ${JSON.stringify(base.concepts)}`,
  });
  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
}
