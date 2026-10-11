import { NextResponse } from "next/server";
import { withUserRoute } from "@proveit/server/userBoundary";
import { getPrefs, setPrefs } from "@proveit/server/prefs";

export const GET = withUserRoute(() => NextResponse.json(getPrefs()));

/** Saves a partial set of choices. Values outside the allowed lists are refused, not stored. */
export const POST = withUserRoute(async (req: Request) => {
  const body = await req.json().catch(() => null);
  try { return NextResponse.json(setPrefs(body)); }
  catch { return NextResponse.json({ error: "That setting isn't one of the choices." }, { status: 400 }); }
});
