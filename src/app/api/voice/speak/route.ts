import { NextResponse } from "next/server";
import { withUserRoute } from "@proveit/server/userBoundary";
import { isTutorVoice } from "@proveit/lib/prefs";

export const maxDuration = 30;

const MAX_CHARS = 1500;

/** Text in, spoken audio out. The ElevenLabs key stays on the server. Without a key this is a 501 and the browser falls back to its own voice. */
async function POSTForUser(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice needs ELEVENLABS_API_KEY on the server." }, { status: 501 });
  const body = (await req.json().catch(() => null)) as { text?: unknown; voiceId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  const voice = isTutorVoice(body?.voiceId) ? body.voiceId : process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5" }),
    signal: req.signal,
  }).catch(() => null);
  if (!res?.ok || !res.body) return NextResponse.json({ error: "The voice service didn't answer. Check the ElevenLabs key and quota." }, { status: 502 });
  return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}

export const POST = withUserRoute(POSTForUser);
