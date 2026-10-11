import { NextResponse } from "next/server";
import { SignBridgeFrameRequest } from "@proveit/lib/signbridge";
import { predictSignBridgeFrame, readSignBridgeJson, SIGNBRIDGE_MAX_BODY_BYTES } from "@proveit/server/signbridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readSignBridgeJson(request, SIGNBRIDGE_MAX_BODY_BYTES);
  if ("error" in body) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = SignBridgeFrameRequest.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Send a valid camera session and base64 JPEG frame." }, { status: 400 });
  try {
    return NextResponse.json(await predictSignBridgeFrame(parsed.data.sessionId, parsed.data.image), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ASL Assistant model request failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
