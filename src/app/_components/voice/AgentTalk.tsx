"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MessageSquare, PhoneOff } from "lucide-react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { cn } from "@proveit/lib/cn";
import { sessionStorageKey } from "@proveit/lib/sessionStorageKey";
import { Orb, type OrbState } from "./Orb";

type Item = { id: number; kind: string; role?: "user" | "assistant"; text?: string };
type Saved = { items: Item[]; mode?: string; followUpTo?: string };

const read = (key: string): Saved | null => {
  try { return JSON.parse(sessionStorage.getItem(key) ?? "null") as Saved | null; } catch { return null; }
};

/**
 * A live voice call with the tutor, on an ElevenLabs agent. The agent's own prompt is replaced by this concept's
 * tutor brief for the call. The transcript goes into the same sessionStorage thread as the chat, so the student
 * can hang up, carry on in the chat, and ask to be checked there. Nothing said here is graded.
 */
function Call({ userId, courseId, conceptId, chatHref }: { userId: string; courseId: string; conceptId: string; chatHref: string }) {
  const storeKey = sessionStorageKey(userId, courseId, conceptId);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [starting, setStarting] = useState(false);
  const saved = useRef<Saved>({ items: [] });
  const opening = useRef<string | null>(null);
  const muteOnConnect = useRef(false);
  const connectedAt = useRef<number | null>(null);
  const conv = useRef<{ setMuted: (m: boolean) => void } | null>(null);

  const add = (role: "user" | "assistant", text: string) => {
    const items = saved.current.items;
    const id = Math.max(0, ...items.map((i) => i.id)) + 1;
    saved.current = { ...saved.current, items: [...items, { id, kind: "chat", role, text }] };
    try { sessionStorage.setItem(storeKey, JSON.stringify(saved.current)); } catch { /* storage is a convenience */ }
  };

  const c = useConversation({
    onMessage: ({ message, source }) => {
      const text = message.trim();
      if (!text) return;
      if (source === "ai") {
        setCaption(text);
        // The chat already shows the concept's opening line, so it isn't added twice.
        if (opening.current !== null && text === opening.current) { opening.current = null; return; }
        add("assistant", text);
      } else add("user", text);
    },
    onError: (message) => {
      setStarting(false);
      setError(message || "The call dropped. Start it again.");
    },
    onConnect: () => {
      connectedAt.current = Date.now();
      if (muteOnConnect.current) conv.current?.setMuted(true);
    },
    onDisconnect: () => {
      setStarting(false);
      // Count the call toward this account's voice minutes.
      const began = connectedAt.current;
      connectedAt.current = null;
      if (began) void fetch("/api/voice/usage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seconds: Math.round((Date.now() - began) / 1000) }), keepalive: true }).catch(() => {});
    },
  });

  useEffect(() => { conv.current = c; });

  const live = c.status === "connected";

  async function start() {
    setError(null);
    setStarting(true);
    saved.current = read(storeKey) ?? { items: [] };
    const history = saved.current.items.flatMap((i) => (i.kind === "chat" && i.role && i.text?.trim() ? [{ role: i.role, text: i.text.slice(0, 2000) }] : [])).slice(-24);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Voice calls need microphone access in this browser.");
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const res = await fetch("/api/voice/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId, conceptId, history }) });
      const json = (await res.json().catch(() => null)) as { conversationToken?: string; prompt?: string; firstMessage?: string; voiceId?: string; startMuted?: boolean; error?: string } | null;
      if (!res.ok || !json?.conversationToken) throw new Error(json?.error ?? "Couldn't start the call. Try again.");
      muteOnConnect.current = Boolean(json.startMuted);
      opening.current = history.length === 0 ? json.firstMessage ?? null : null;
      await Promise.resolve(c.startSession({
        conversationToken: json.conversationToken,
        connectionType: "webrtc",
        overrides: { agent: { prompt: { prompt: json.prompt }, firstMessage: json.firstMessage }, ...(json.voiceId ? { tts: { voiceId: json.voiceId } } : {}) },
      }));
    } catch (e) {
      setStarting(false);
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
        setError("Microphone access is blocked. Allow it in your browser and try again.");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't start the call. Try again.");
      }
    }
  }

  function tapOrb() {
    if (!live) { if (!starting) void start(); return; }
    c.setMuted(!c.isMuted);
  }

  const state: OrbState = !live ? "muted" : c.isMuted ? "muted" : c.isSpeaking ? "tutor" : "listening";
  const status = starting && !live ? "Connecting..."
    : !live ? "Tap to start the call."
    : c.isMuted ? "Muted. Tap the orb to talk."
    : c.isSpeaking ? "Your tutor is speaking. Just talk to cut in."
    : "Listening. Talk like you would to a person.";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between px-7 py-8">
      <div className="flex w-full max-w-[640px] justify-end">
        <Link href={chatHref} onClick={() => c.endSession()} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink-3 no-underline hover:bg-surface-hover">
          <MessageSquare size={13} aria-hidden />Back to chat
        </Link>
      </div>
      <div className="flex flex-col items-center gap-6">
        <Orb state={state} size={200} label={!live ? "Start the call" : c.isMuted ? "Unmute" : "Mute"} onClick={tapOrb} />
        <p role="status" className="m-0 text-sm text-ink-muted">{status}</p>
        {error && <p role="alert" className="m-0 max-w-[420px] text-center text-xs text-needswork-text">{error}</p>}
        {live && (
          <button type="button" onClick={() => c.endSession()} className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-button bg-surface px-4 text-xs font-semibold text-ink hover:bg-surface-hover")}>
            <PhoneOff size={13} aria-hidden />End call
          </button>
        )}
      </div>
      <p aria-live="polite" className="m-0 line-clamp-3 min-h-[3.6em] max-w-[560px] text-center text-[0.8125rem] leading-[1.5] text-ink-3">{caption}</p>
    </div>
  );
}

export function AgentTalk(props: { userId: string; courseId: string; conceptId: string; chatHref: string }) {
  return <ConversationProvider><Call {...props} /></ConversationProvider>;
}
