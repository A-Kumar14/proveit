import "server-only";
import { DEFAULT_PREFS, Prefs, PrefsPatch } from "@proveit/lib/prefs";
import { loadUserJson, saveUserJson } from "./persistence";

/** Per-account tutor, voice and quiz choices. Anything unknown or out of range falls back to the default. */
export function getPrefs(): Prefs {
  const parsed = Prefs.safeParse(loadUserJson<unknown>("prefs") ?? {});
  return parsed.success ? parsed.data : DEFAULT_PREFS;
}

export function setPrefs(patch: unknown): Prefs {
  const next = PrefsPatch.parse(patch);
  const merged = Prefs.parse({ ...getPrefs(), ...next });
  saveUserJson("prefs", merged);
  return merged;
}

type Usage = { seconds: number; calls: number };
const MAX_CALL_SECONDS = 30 * 60;

/** Voice call time per account. The browser reports it, so each call counts for at most 30 minutes. */
export function getVoiceUsage(): Usage {
  const u = loadUserJson<Partial<Usage>>("voice-usage");
  return { seconds: Math.max(0, Math.floor(Number(u?.seconds) || 0)), calls: Math.max(0, Math.floor(Number(u?.calls) || 0)) };
}

export function addVoiceUsage(seconds: number): Usage {
  const add = Math.min(MAX_CALL_SECONDS, Math.max(0, Math.floor(Number(seconds) || 0)));
  const u = getVoiceUsage();
  const next = { seconds: u.seconds + add, calls: u.calls + (add > 0 ? 1 : 0) };
  saveUserJson("voice-usage", next);
  return next;
}

/** Minutes each account may use, from VOICE_MINUTES_CAP. Unset or 0 means no limit. */
export function voiceCapSeconds(): number | null {
  const m = Number(process.env.VOICE_MINUTES_CAP);
  return Number.isFinite(m) && m > 0 ? Math.floor(m * 60) : null;
}
