"use client";

import { useSyncExternalStore } from "react";

type Result = { isFinal: boolean; 0: { transcript: string } };
export type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const ctor = () => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const createRecognition = () => {
  const C = ctor();
  return C ? new C() : null;
};

/** True where the browser can transcribe speech (Chrome, Edge, Safari). False on the server and in Firefox. */
export const useVoiceSupport = () => useSyncExternalStore(() => () => {}, () => ctor() !== null, () => false);

export function speak(text: string, onStart: () => void, onDone: () => void) {
  if (typeof speechSynthesis === "undefined") return onDone();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.onstart = onStart;
  u.onend = onDone;
  u.onerror = onDone;
  speechSynthesis.speak(u);
}

/** Speaks `text`, then calls `next`. If speech never starts (blocked or unsupported) `next` still runs. */
export function speakThen(text: string, next: () => void) {
  let started = false;
  let finished = false;
  const go = () => { if (!finished) { finished = true; next(); } };
  const guard = setTimeout(() => { if (!started) { speechSynthesis?.cancel(); go(); } }, 1500);
  speak(text, () => { started = true; clearTimeout(guard); }, () => { clearTimeout(guard); go(); });
}
