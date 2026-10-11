import { NextResponse } from "next/server";
import { SignBridgeMotionRequest } from "@proveit/lib/signbridge";
import { readSignBridgeJson, recognizeSignBridgeMotion } from "@proveit/server/signbridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readSignBridgeJson(request, 4_000_000);
  if ("error" in body) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = SignBridgeMotionRequest.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Send a valid session and 2–12 base64 JPEG frames." }, { status: 400 });
  try {
    return NextResponse.json(await recognizeSignBridgeMotion(parsed.data.sessionId, parsed.data.frames), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ASL Assistant motion request failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
