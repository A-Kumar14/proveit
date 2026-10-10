import { withUserRoute } from "@proveit/server/userBoundary";
import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { UploadCheck } from "@proveit/lib/schemas";
import { aiEnabled, model } from "@proveit/server/ai";
import { AUTHORED } from "@proveit/server/content";

export const maxDuration = 60;

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 5 * 1024 * 1024;

/**
 * Decides whether an upload is the student's own relevant work. Only a pass is ever sent to evaluate.
 * Anything else, including a failure to check, keeps the file out.
 */
async function POSTForUser(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const conceptId = form?.get("conceptId");
  if (!(file instanceof File) || typeof conceptId !== "string") return NextResponse.json({ error: "Attach an image." }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Images can be up to 5 MB." }, { status: 400 });
  const concept = AUTHORED[conceptId];
  if (!concept) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!aiEnabled()) return NextResponse.json({ error: "Uploads need GOOGLE_GENERATIVE_AI_API_KEY on the server." }, { status: 501 });

  try {
    const { output } = await generateText({
      model: model(),
      output: Output.object({ schema: UploadCheck }),
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `A student attached this image while answering: "${concept.question}"
Decide:
- is_student_work: true only if it shows the student's own handwriting, sketch or typed answer. False for lecture slides, textbook pages, screenshots of other people's text, or unrelated photos.
- relevant: true only if it addresses the question's topic.
- summary: a faithful transcription of what the student wrote or drew. Empty string if is_student_work is false.
- reason: one short sentence explaining the decision.`,
          },
          { type: "file", data: new Uint8Array(await file.arrayBuffer()), mediaType: file.type },
        ],
      }],
    });
    return NextResponse.json(output);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The upload check failed. Retry." }, { status: 500 });
  }
}

export const POST = withUserRoute(POSTForUser);
