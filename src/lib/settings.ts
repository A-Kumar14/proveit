"use client";

import { useCallback, useSyncExternalStore } from "react";
import { A11Y_DEFAULTS, sanitizeA11y, SETTINGS_KEY, type A11ySettings } from "./a11y";

export type Settings = { answerMode: "type" | "talk"; showHints: boolean; speakQuestions: boolean; /** Show the Sign button, which spells a message with the camera. */ signInput: boolean } & A11ySettings;
const DEFAULTS: Settings = { answerMode: "type", showHints: true, speakQuestions: true, signInput: true, ...A11Y_DEFAULTS };
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Settings } | null = null;

/** Unknown or out-of-range values fall back to the default, so an old or hand-edited entry can't break the page. */
function sanitize(raw: Partial<Settings>): Settings {
  return {
    answerMode: raw.answerMode === "talk" ? "talk" : "type",
    showHints: typeof raw.showHints === "boolean" ? raw.showHints : DEFAULTS.showHints,
    speakQuestions: typeof raw.speakQuestions === "boolean" ? raw.speakQuestions : DEFAULTS.speakQuestions,
    signInput: typeof raw.signInput === "boolean" ? raw.signInput : DEFAULTS.signInput,
    ...sanitizeA11y(raw),
  };
}

function read(): Settings {
  let raw: string | null = null;
  try { raw = localStorage.getItem(SETTINGS_KEY); } catch { /* private mode: fall back to defaults */ }
  if (cached?.raw === raw) return cached.value;
  let value = DEFAULTS;
  try { value = sanitize(raw ? (JSON.parse(raw) as Partial<Settings>) : {}); } catch { /* corrupt value: defaults */ }
  cached = { raw, value };
  return value;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
};

/** Client-only preferences. Only settings that change behavior live here. */
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const update = useCallback((patch: Partial<Settings>) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* not persisted */ }
    listeners.forEach((l) => l());
  }, []);
  return [settings, update] as const;
}
