import { NextResponse } from "next/server";
import { checkSignBridgeHealth } from "@proveit/server/signbridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await checkSignBridgeHealth(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ASL Assistant service is unavailable.";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
