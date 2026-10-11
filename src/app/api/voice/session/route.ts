import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserRoute } from "@proveit/server/userBoundary";
import { voiceBrief } from "@proveit/server/session";
import { getPrefs, getVoiceUsage, voiceCapSeconds } from "@proveit/server/prefs";
import { ensureQuestion, NotFoundError } from "@proveit/server/store";

export const maxDuration = 30;

const Body = z.object({
  courseId: z.string().min(1).max(100),
  conceptId: z.string().min(1).max(100),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(24).default([]),
});

/** Whether the agent allows the prompt and first-message overrides we send. Unknown (a failed lookup) counts as allowed, so a flaky check never blocks a call. */
async function overridesAllowed(agent: string, key: string, signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agent)}`, { headers: { "xi-api-key": key }, signal }).catch(() => null);
  const json = (await res?.json().catch(() => null)) as { platform_settings?: { overrides?: { conversation_config_override?: { agent?: { first_message?: boolean; prompt?: { prompt?: boolean } } } } } } | null;
  const a = json?.platform_settings?.overrides?.conversation_config_override?.agent;
  if (!res?.ok || !a) return true;
  return a.first_message === true && a.prompt?.prompt === true;
}

/**
 * Starts a voice call with the ElevenLabs agent. The key stays here. The browser gets a short-lived token and the
 * tutor's brief for this concept, which replaces the agent's stored prompt for this one call.
 */
async function POSTForUser(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  const agent = process.env.ELEVENLABS_AGENT_ID;
  if (!key || !agent) return NextResponse.json({ error: "Voice calls need ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID on the server." }, { status: 501 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing concept." }, { status: 400 });
  const { courseId, conceptId, history } = parsed.data;
  const cap = voiceCapSeconds();
  if (cap !== null && getVoiceUsage().seconds >= cap) return NextResponse.json({ error: `You've used your ${Math.round(cap / 60)} minutes of voice. You can keep going in the chat.` }, { status: 429 });

  let brief: { prompt: string; firstMessage: string };
  try {
    await ensureQuestion(courseId, conceptId);
    brief = voiceBrief(courseId, conceptId, history);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }

  if (!(await overridesAllowed(agent, key, req.signal))) {
    return NextResponse.json({ error: "The ElevenLabs agent doesn't allow overrides yet. In the agent's Security tab, turn on System prompt and First message under overrides, then publish." }, { status: 502 });
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agent)}`, {
    headers: { "xi-api-key": key }, signal: req.signal,
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { token?: unknown } | null;
  if (!res?.ok || typeof body?.token !== "string") return NextResponse.json({ error: "The voice service didn't start a call. Check the ElevenLabs key and agent ID." }, { status: 502 });
  const prefs = getPrefs();
  return NextResponse.json({ conversationToken: body.token, prompt: brief.prompt, firstMessage: brief.firstMessage, voiceId: prefs.tutorVoice, startMuted: prefs.startMuted });
}

export const POST = withUserRoute(POSTForUser);
