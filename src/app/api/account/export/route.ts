import { NextResponse } from "next/server";
import { withUserRoute } from "@proveit/server/userBoundary";
import { exportLearning } from "@proveit/server/store";
import { getPrefs, getVoiceUsage } from "@proveit/server/prefs";

/** A download of this account's learning record and choices. It never includes keys or other accounts. */
export const GET = withUserRoute(() => {
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), preferences: getPrefs(), voiceUsage: getVoiceUsage(), ...exportLearning() }, null, 2);
  return new NextResponse(body, { headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="mastery-export.json"', "cache-control": "no-store" } });
});
