"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { streamTutor } from "@proveit/lib/tutorStream";
import { forSpeech } from "@proveit/lib/speechText";
import { sessionStorageKey } from "@proveit/lib/sessionStorageKey";
import { cn } from "@proveit/lib/cn";
import { Orb, type OrbState } from "./Orb";
import { playSpeech } from "./playSpeech";
import { useDictation } from "./useDictation";
import { useVoiceSupport } from "./speech";

type Item = { id: number; kind: string; role?: "user" | "assistant"; text?: string };
type Saved = { items: Item[]; mode?: string; followUpTo?: string };

/** After this much silence the student's turn is over and the tutor answers. */
const DEFAULT_SILENCE_MS = 1600;

/**
 * A spoken, back-and-forth conversation with the tutor about one concept. It shares its transcript with the chat
 * through sessionStorage, so the student can switch between talking and typing without losing the thread.
 * Nothing here is graded. The check happens back in the chat.
 */
export function TalkChat({ userId, courseId, conceptId, opening, chatHref, silenceMs = DEFAULT_SILENCE_MS }: { silenceMs?: number; userId: string; courseId: string; conceptId: string; opening: string; chatHref: string }) {
  const storeKey = sessionStorageKey(userId, courseId, conceptId);
  const supported = useVoiceSupport();
  const [phase, setPhase] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState("");
  const phaseRef = useRef(phase);
  const mutedRef = useRef(false);
  const saved = useRef<Saved>({ items: [{ id: 1, kind: "chat", role: "assistant", text: opening }] });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const turn = useRef<(() => void) | null>(null);
  const go = useCallback((p: typeof phase) => { phaseRef.current = p; setPhase(p); }, []);
  const persist = () => { try { sessionStorage.setItem(storeKey, JSON.stringify(saved.current)); } catch { /* storage is a convenience */ } };

  const dictation = useDictation(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => turn.current?.(), silenceMs);
  });
  const { start, stop, take } = dictation;

  const listen = useCallback(() => { go(mutedRef.current ? "idle" : "listening"); if (!mutedRef.current) start(); }, [go, start]);

  const speakOut = useCallback((text: string) => {
    const say = forSpeech(text);
    if (!say) return listen();
    stop();
    go("speaking");
    stopSpeech.current = playSpeech(say, () => {}, () => { stopSpeech.current = null; if (phaseRef.current === "speaking") listen(); });
  }, [go, listen, stop]);

  // The student finished talking. Send the turn and let the tutor's reply stream in, then say it.
  useEffect(() => {
    turn.current = () => {
      const said = take();
      if (!said || phaseRef.current !== "listening") return;
      stop();
      go("thinking");
      setError(null);
      const items = saved.current.items;
      const nextId = Math.max(...items.map((i) => i.id)) + 1;
      const before = items;
      const withUser = [...items, { id: nextId, kind: "chat", role: "user" as const, text: said }];
      const history = withUser.flatMap((i) => (i.kind === "chat" && i.id !== 1 && i.text?.trim() && i.role ? [{ role: i.role, text: i.text }] : []));
      const ctrl = new AbortController();
      abort.current = ctrl;
      streamTutor({ courseId, messages: history, files: [], signal: ctrl.signal, endpoint: "/api/session", fields: { conceptId } }, setShown)
        .then((full) => {
          if (!full.trim()) throw new Error("Your tutor sent an empty reply. Try again.");
          saved.current = { ...saved.current, items: [...withUser, { id: nextId + 1, kind: "chat", role: "assistant", text: full }] };
          persist();
          speakOut(full);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          saved.current = { ...saved.current, items: before };
          setError(e instanceof Error ? e.message : "Your tutor didn't answer. Try again.");
          listen();
        });
    };
  });

  // Pick up the thread, then say the last thing the tutor said, or start listening if the student spoke last.
  useEffect(() => {
    if (!supported) return;
    const t = setTimeout(() => {
      try {
        const s = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as Saved | null;
        if (s && Array.isArray(s.items) && s.items.length > 0) saved.current = s;
      } catch { /* start from the opening */ }
      const last = saved.current.items.at(-1);
      setShown(last?.text ?? "");
      if (last?.kind === "chat" && last.role === "assistant" && last.text) speakOut(last.text); else listen();
    }, 0);
    return () => {
      clearTimeout(t);
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
      stopSpeech.current?.();
      stop();
    };
    // Runs once on arrival. The callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  function tapOrb() {
    if (phase === "speaking") { const s = stopSpeech.current; stopSpeech.current = null; s?.(); listen(); return; }
    if (phase === "thinking") { abort.current?.abort(); listen(); return; }
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) { stop(); go("idle"); } else listen();
  }

  const state: OrbState = muted ? "muted" : phase === "speaking" ? "tutor" : "listening";
  const caption = !supported ? "Speech mode needs Chrome, Edge or Safari. You can keep going in the chat."
    : muted ? "Muted. Tap the orb to talk."
    : phase === "listening" ? "Listening. Talk like you would to a person."
    : phase === "thinking" ? "Thinking..."
    : phase === "speaking" ? "Speaking. Tap to cut in."
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between px-7 py-8">
      <div className="flex w-full max-w-[640px] justify-end">
        <Link href={chatHref} className={cn("inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink-3 no-underline hover:bg-surface-hover")}>
          <MessageSquare size={13} aria-hidden />Back to chat
        </Link>
      </div>
      <div className="flex flex-col items-center gap-6">
        {supported && <Orb state={state} size={200} label={phase === "speaking" ? "Interrupt the tutor" : muted ? "Unmute" : "Mute"} onClick={tapOrb} />}
        <p role="status" className="m-0 text-sm text-ink-muted">{caption}</p>
        {error && <p role="alert" className="m-0 max-w-[420px] text-center text-xs text-ink-3">{error}</p>}
      </div>
      <p aria-live="polite" className="m-0 line-clamp-3 min-h-[3.6em] max-w-[560px] text-center text-[13px] leading-[1.5] text-ink-3">{phase === "thinking" ? "" : forSpeech(shown)}</p>
    </div>
  );
}

