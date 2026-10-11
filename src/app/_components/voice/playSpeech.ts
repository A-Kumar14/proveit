"use client";

import { speak } from "./speech";

let serverVoice = true;

/**
 * Says `text` out loud and returns a stop function. Uses the ElevenLabs voice through the server when it is set up,
 * and the browser's own voice when it isn't. `onDone` fires once, whether the speech ends, fails or is stopped.
 */
export function playSpeech(text: string, onStart: () => void, onDone: () => void): () => void {
  let done = false;
  let audio: HTMLAudioElement | null = null;
  let url = "";
  const ctrl = new AbortController();
  const finish = () => { if (!done) { done = true; if (url) URL.revokeObjectURL(url); onDone(); } };
  const browser = () => { if (!done) speak(text, onStart, finish); };

  if (!serverVoice) browser();
  else {
    void (async () => {
      try {
        const res = await fetch("/api/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: ctrl.signal });
        if (res.status === 501) serverVoice = false;
        if (!res.ok) return browser();
        url = URL.createObjectURL(await res.blob());
        audio = new Audio(url);
        audio.onplaying = onStart;
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) browser();
      }
    })();
  }
  return () => {
    ctrl.abort();
    audio?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    finish();
  };
}
