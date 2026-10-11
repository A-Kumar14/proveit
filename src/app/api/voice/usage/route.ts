import { NextResponse } from "next/server";
import { withUserRoute } from "@proveit/server/userBoundary";
import { addVoiceUsage } from "@proveit/server/prefs";

/** The browser reports how long a call lasted when it ends. */
export const POST = withUserRoute(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { seconds?: unknown } | null;
  if (typeof body?.seconds !== "number") return NextResponse.json({ error: "Missing seconds." }, { status: 400 });
  return NextResponse.json(addVoiceUsage(body.seconds));
});
