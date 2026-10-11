import { NextResponse } from "next/server";
import { SignBridgeResetRequest } from "@proveit/lib/signbridge";
import { readSignBridgeJson, resetSignBridgeSession, SIGNBRIDGE_MAX_BODY_BYTES } from "@proveit/server/signbridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readSignBridgeJson(request, SIGNBRIDGE_MAX_BODY_BYTES);
  if ("error" in body) return NextResponse.json({ error: body.error }, { status: body.status });
  const parsed = SignBridgeResetRequest.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Send a valid camera session ID." }, { status: 400 });
  try {
    await resetSignBridgeSession(parsed.data.sessionId);
    return NextResponse.json({ reset: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ASL Assistant session could not be reset.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
