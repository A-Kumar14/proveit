"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Settings = { answerMode: "type" | "talk"; showHints: boolean };
const DEFAULTS: Settings = { answerMode: "type", showHints: true };
const KEY = "proveit.settings";
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: Settings } | null = null;

function read(): Settings {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* private mode: fall back to defaults */ }
  if (cached?.raw === raw) return cached.value;
  let value = DEFAULTS;
  try { value = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) }; } catch { /* corrupt value: defaults */ }
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
    try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* not persisted */ }
    listeners.forEach((l) => l());
  }, []);
  return [settings, update] as const;
}
