"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Paperclip, X } from "lucide-react";
import { streamTutor } from "@proveit/lib/tutorStream";
import { cn } from "@proveit/lib/cn";
import type { ReviewBase } from "@proveit/server/store";
import { AssistantMessage } from "../chat/AssistantMessage";
import { Prose } from "../chat/Prose";
import { Typing } from "../chat/Typing";
import { UserBubble } from "../chat/UserBubble";
import { MasteryReviewCard } from "../mastery/MasteryReviewCard";
import { Composer, type Status } from "../shell/Composer";
import { Log } from "../shell/Log";
import { speakThen, useVoiceSupport } from "../voice/speech";
import { useDictation } from "../voice/useDictation";
import { VoiceDock } from "../voice/VoiceDock";

type Msg = { id: number; role: "user" | "assistant" | "review"; text: string; files?: string[] };
type VoicePhase = "listening" | "thinking" | "speaking";

const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const SILENCE_MS = 2500;
const VOICE_LABEL: Record<VoicePhase, string> = { listening: "Listening", thinking: "Thinking", speaking: "Tutor is talking" };

const STARTERS = [
  { label: "How am I doing?", kind: "review" as const },
  { label: "What should I fix before the quiz?", kind: "ask" as const, text: "What should I fix before the quiz? Give me a short plan." },
  { label: "Quiz me", kind: "ask" as const, text: "Quiz me on a concept I'm weak at. One question at a time, and wait for my answer." },
  { label: "Explain a concept", kind: "draft" as const, text: "Explain " },
];

/** The reply as plain speech: no list markers or bold stars. */
const spoken = (t: string) => t.replace(/[*`#]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s+/g, " ").trim();

export function TutorChat({ courseId, courseName, base, aiWritten, enabled }: { courseId: string; courseName: string; base: ReviewBase; aiWritten: boolean; enabled: boolean }) {
  const canTalk = useVoiceSupport();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const [voice, setVoice] = useState<VoicePhase | null>(null);
  const [muted, setMuted] = useState(false);
  const messagesRef = useRef<Msg[]>([]);
  const voiceOn = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finish = useRef<() => void>(() => {});
  const nextId = useRef(1);
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const arm = useCallback(() => {
    if (!voiceOn.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => finish.current(), SILENCE_MS);
  }, []);
  const { start, stop, take, text: heard, blocked } = useDictation(arm);

  const put = useCallback((next: Msg[]) => { messagesRef.current = next; setMessages(next); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);
  useEffect(() => () => { clearTimeout(timer.current); abort.current?.abort(); speechSynthesis?.cancel(); }, []);

  /** Sends one message and streams the reply into a new assistant bubble. Returns the reply, or null if it failed or was stopped. */
  const send = useCallback(async (text: string, attached: File[]): Promise<string | null> => {
    const user: Msg = { id: nextId.current++, role: "user", text, files: attached.map((f) => f.name) };
    const reply: Msg = { id: nextId.current++, role: "assistant", text: "" };
    const before = messagesRef.current;
    put([...before, user, reply]);
    setStatus("evaluating");
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const history = [...before, user].filter((m) => m.role !== "review" && m.text.trim()).map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));
    try {
      const full = await streamTutor({ courseId, messages: history, files: attached, signal: ctrl.signal },
        (soFar) => put(messagesRef.current.map((m) => (m.id === reply.id ? { ...m, text: soFar } : m))));
      setStatus("idle");
      if (!full.trim()) { put(messagesRef.current.filter((m) => m.id !== reply.id)); setError("The tutor sent an empty reply. Retry."); return null; }
      return full;
    } catch (e) {
      setStatus("idle");
      const stopped = e instanceof DOMException && e.name === "AbortError";
      const partial = messagesRef.current.find((m) => m.id === reply.id)?.text ?? "";
      if (stopped && partial) { put(messagesRef.current); return null; }
      // Take the failed turn back so the student can edit it and send again.
      put(before);
      if (!stopped) { setError(e instanceof Error ? e.message : "The tutor didn't answer. Retry."); setStatus("error"); setDraft(text); setFiles(attached); }
      return null;
    }
  }, [courseId, put]);

  function submit() {
    const text = draft.trim();
    if (!text || status === "evaluating") return;
    const attached = files;
    setDraft(""); setFiles([]);
    void send(text, attached);
  }

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    const bad = next.find((f) => !TYPES.includes(f.type)) ?? null;
    if (bad) return setError(`${bad.name} isn't supported. Use a PNG, JPEG, WebP or PDF.`);
    if (next.length > MAX_FILES) return setError(`Attach up to ${MAX_FILES} files.`);
    const big = next.find((f) => f.size > MAX_BYTES);
    if (big) return setError(`${big.name} is over 10 MB.`);
    setError(null);
    setFiles(next);
    if (picker.current) picker.current.value = "";
  }

  function toggleDictation() {
    if (dictating) { stop(); const said = take(); setDictating(false); if (said) setDraft((d) => `${d} ${said}`.trim()); }
    else { take(); start(); setDictating(true); }
  }

  // ---- spoken conversation ----

  const listen = useCallback(() => { if (!voiceOn.current) return; setVoice("listening"); take(); start(); }, [start, take]);

  useEffect(() => {
    finish.current = () => {
      clearTimeout(timer.current);
      const said = take();
      if (!said || !voiceOn.current) return;
      stop();
      setVoice("thinking");
      void send(said, []).then((reply) => {
        if (!voiceOn.current) return;
        if (!reply) return listen();
        setVoice("speaking");
        speakThen(spoken(reply), listen);
      });
    };
  });

  function startVoice() {
    if (dictating) { stop(); take(); setDictating(false); }
    voiceOn.current = true;
    setMuted(false);
    listen();
  }
  function endVoice() {
    voiceOn.current = false;
    clearTimeout(timer.current);
    stop(); take();
    speechSynthesis?.cancel();
    abort.current?.abort();
    setVoice(null);
  }
  function toggleMute() {
    if (muted) { setMuted(false); if (voice === "listening") start(); }
    else { setMuted(true); clearTimeout(timer.current); stop(); }
  }

  function starter(s: (typeof STARTERS)[number]) {
    if (s.kind === "review") put([...messagesRef.current, { id: nextId.current++, role: "review", text: "" }]);
    else if (s.kind === "ask") void send(s.text, []);
    else setDraft(s.text);
  }

  const active = voice === "listening" && !muted;
  const empty = messages.length === 0;
  return (
    <>
      <Log>
        <AssistantMessage>
          <div className="w-fit max-w-[640px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-3">
            <Prose text={enabled ? `I'm your tutor for ${courseName}. Ask me anything, attach a file, or talk it through. I know where you're strong and where you're stuck.` : `I'm your tutor for ${courseName}, but I need a Gemini key on the server before I can answer. Add GOOGLE_GENERATIVE_AI_API_KEY and restart.`} />
          </div>
          {empty && enabled && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s.label} type="button" onClick={() => starter(s)} className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-3 hover:bg-surface-hover">{s.label}</button>
              ))}
            </div>
          )}
        </AssistantMessage>
        {messages.map((m) => m.role === "user"
          ? (
            <UserBubble key={m.id}>
              {m.files && m.files.length > 0 && <div className="mb-1.5 flex flex-wrap gap-1.5">{m.files.map((f) => <span key={f} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] text-ink-3"><Paperclip size={10} aria-hidden />{f}</span>)}</div>}
              <span className="whitespace-pre-wrap">{m.text}</span>
            </UserBubble>
          )
          : m.role === "review"
            ? <AssistantMessage key={m.id}><MasteryReviewCard courseId={courseId} courseName={courseName} base={base} aiWritten={aiWritten} /></AssistantMessage>
            : (
              <AssistantMessage key={m.id}>
                {m.text
                  ? <div className="w-fit max-w-[640px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-3"><Prose text={m.text} /></div>
                  : <Typing />}
              </AssistantMessage>
            ))}
        <div ref={end} />
      </Log>
      {voice ? (
        <VoiceDock
          muted={muted} onToggleMute={toggleMute} waving={voice === "speaking" || active} onExit={endVoice}
          status={error ? <span className="text-needswork-text">{error}</span>
            : blocked ? <span className="text-needswork-text">The microphone is blocked. Allow it in your browser, or type instead.</span>
            : <span className="text-ink-muted">{muted ? "Mic paused" : voice === "listening" && heard ? heard : VOICE_LABEL[voice]}</span>}
          actions={active && <button type="button" onClick={() => finish.current()} disabled={!heard} className="h-9 cursor-pointer rounded-full border-0 bg-ink px-4 text-xs font-semibold text-white hover:bg-ink-3 disabled:cursor-not-allowed disabled:bg-surface-strong disabled:text-ink-faint">Done talking</button>}
        />
      ) : (
        <Composer
          value={draft} onChange={setDraft} onSubmit={submit} status={enabled ? status : "idle"} error={enabled ? error : null}
          placeholder={enabled ? "Ask the tutor anything" : "The tutor needs a Gemini key"} submitLabel="Send" loadingText="Tutor is replying..."
          hint={dictating ? (heard || "Listening. Tap the mic to stop.") : "Proof of understanding comes from Test this concept."}
          onStop={() => abort.current?.abort()}
          onTalk={enabled ? startVoice : undefined} talkUnavailable={!canTalk}
          leading={(
            <>
              <input ref={picker} type="file" multiple accept={TYPES.join(",")} className="sr-only" tabIndex={-1} aria-label="Choose files" onChange={(e) => pick(e.target.files)} />
              <button type="button" onClick={() => picker.current?.click()} disabled={!enabled || status === "evaluating"} aria-label="Attach files" title="Attach images or PDFs" className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-3 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"><Paperclip size={16} strokeWidth={2} aria-hidden /></button>
              {canTalk && <button type="button" onClick={toggleDictation} disabled={!enabled || status === "evaluating"} aria-pressed={dictating} aria-label={dictating ? "Stop dictating" : "Dictate"} title={dictating ? "Stop dictating" : "Dictate into the box"} className={cn("flex size-9 cursor-pointer items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50", dictating ? "border-needswork bg-needswork text-white" : "border-line bg-surface text-ink-3 hover:bg-surface-hover")}><Mic size={16} strokeWidth={2} aria-hidden /></button>}
            </>
          )}
          chip={files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex w-fit items-center gap-1.5 rounded-full border border-line bg-surface-hover px-2.5 py-0.5 text-[0.6875rem] text-ink-3">
                  <Paperclip size={11} aria-hidden />{f.name}
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} className="flex cursor-pointer border-0 bg-transparent p-0 text-ink-3"><X size={11} aria-hidden /></button>
                </span>
              ))}
            </div>
          )}
        />
      )}
    </>
  );
}
