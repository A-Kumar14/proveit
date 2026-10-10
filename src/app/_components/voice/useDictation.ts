"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRecognition, type Recognition } from "./speech";

/**
 * Continuous speech to text. `onSpeech` fires on every recognised chunk, so callers can run a silence timer.
 * `take()` returns what was said since the last take and clears it.
 */
export function useDictation(onSpeech: () => void) {
  const rec = useRef<Recognition | null>(null);
  const finals = useRef("");
  const live = useRef("");
  const want = useRef(false);
  const cb = useRef(onSpeech);
  const [text, setText] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { cb.current = onSpeech; });

  const stop = useCallback(() => {
    want.current = false;
    rec.current?.abort();
    rec.current = null;
  }, []);

  const start = useCallback(() => {
    stop();
    const r = createRecognition();
    if (!r) return setBlocked(true);
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      live.current = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finals.current += `${res[0].transcript} `;
        else live.current += res[0].transcript;
      }
      setText(`${finals.current}${live.current}`.trim());
      cb.current();
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { want.current = false; setBlocked(true); } };
    // Chrome ends continuous sessions on silence. Restart while the student still has the floor.
    r.onend = () => { if (want.current) { try { r.start(); } catch { /* already running */ } } };
    rec.current = r;
    want.current = true;
    setBlocked(false);
    try { r.start(); } catch { /* already running */ }
  }, [stop]);

  const take = useCallback(() => {
    const t = `${finals.current}${live.current}`.trim();
    finals.current = "";
    live.current = "";
    setText("");
    return t;
  }, []);

  useEffect(() => stop, [stop]);
  return { start, stop, take, text, blocked };
}
