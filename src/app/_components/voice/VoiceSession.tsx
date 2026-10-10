"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Keyboard, Mic, MicOff, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { QuestionView } from "@proveit/server/store";
import { Button, buttonStyles } from "../Button";
import { AddFileMenu } from "../upload/AddFileMenu";
import { Orb, type OrbState } from "./Orb";
import { useSettings } from "@proveit/lib/settings";
import { createRecognition, speak, useVoiceSupport, type Recognition } from "./speech";

type Phase = "tutor" | "listening" | "review";
type Shown = { name: string; ok: boolean; summary: string; reason: string };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VoiceSession({ courseId, question, typeHref, uploads }: { courseId: string; question: QuestionView; typeHref: string; uploads: { enabled: boolean; demo: boolean } }) {
  const router = useRouter();
  const supported = useVoiceSupport();
  const [settings] = useSettings();
  const [phase, setPhase] = useState<Phase>("tutor");
  const [muted, setMuted] = useState(false);
  const [spoken, setSpoken] = useState("");
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [prompt, setPrompt] = useState(question.prompt);
  const [followUpTo, setFollowUpTo] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const rec = useRef<Recognition | null>(null);
  const finals = useRef("");
  const wantListening = useRef(false);

  const stopRec = useCallback(() => {
    wantListening.current = false;
    rec.current?.abort();
    rec.current = null;
  }, []);

  const startRec = useCallback(() => {
    const r = createRecognition();
    if (!r) return;
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finals.current += `${res[0].transcript} `;
        else live += res[0].transcript;
      }
      setSpoken(finals.current.trim());
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListening.current = false;
        setError("The microphone is blocked. Allow it in your browser, or switch to typing.");
      }
    };
    // Chrome ends continuous sessions on silence. Restart while the student still has the floor.
    r.onend = () => { if (wantListening.current) { try { r.start(); } catch { /* already running */ } } };
    rec.current = r;
    wantListening.current = true;
    try { r.start(); } catch { /* already running */ }
  }, []);

  const listen = useCallback(() => { setPhase("listening"); setError(null); startRec(); }, [startRec]);

  // The tutor reads the question first. If speech never starts (blocked or unsupported), go straight to listening.
  useEffect(() => {
    if (phase !== "tutor") return;
    if (!settings.speakQuestions) {
      const t = setTimeout(listen, 0);
      return () => clearTimeout(t);
    }
    let started = false;
    const guard = setTimeout(() => { if (!started) { speechSynthesis?.cancel(); listen(); } }, 1500);
    speak(prompt, () => { started = true; clearTimeout(guard); }, () => { clearTimeout(guard); listen(); });
    return () => { clearTimeout(guard); speechSynthesis?.cancel(); };
  }, [phase, prompt, listen, settings.speakQuestions]);

  useEffect(() => { const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => () => { stopRec(); speechSynthesis?.cancel(); }, [stopRec]);

  function toggleMute() {
    if (muted) { setMuted(false); if (phase === "listening") startRec(); }
    else { setMuted(true); stopRec(); }
  }

  function review() {
    stopRec();
    speechSynthesis?.cancel();
    setDraft(`${finals.current} ${interim}`.trim());
    setPhase("review");
  }

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { attemptId, evaluation } = await api.assess({ courseId, conceptId: question.conceptId, answer: draft, followUpTo, imageSummary: shown?.ok ? shown.summary : undefined });
      if (evaluation.verdict !== "uncertain") return router.push(`/course/${courseId}/diagnosis/${attemptId}`);
      finals.current = "";
      setSpoken(""); setInterim(""); setFollowUpTo(attemptId);
      setPrompt(evaluation.followUp ?? "Say a bit more.");
      setPhase("tutor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  }

  const offTopic = shown !== null && !shown.ok;
  const orb: OrbState = muted ? "muted" : phase === "tutor" || offTopic ? "tutor" : "listening";
  const showing = shown !== null;
  const status = muted ? "Mic paused" : offTopic ? 'Tutor: "Show me your own work"' : phase === "tutor" ? "Tutor is asking" : showing ? "Listening and watching" : "Listening";
  const hint = muted ? "Unmute when you are ready to keep explaining."
    : offTopic ? shown.reason
    : phase === "tutor" ? prompt
    : showing ? "Talk while you work. The tutor follows along." : "Explain it like you would to a classmate.";

  if (!supported) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-surface text-center">
        <div className="text-lg font-semibold">Voice isn&apos;t available in this browser</div>
        <p className="m-0 max-w-sm text-sm text-ink-muted">Speech transcription works in Chrome, Edge and Safari. You can type your answer instead.</p>
        <Link href={typeHref} className={buttonStyles()}>Switch to typing</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-sidebar px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink"><BarChart3 size={16} strokeWidth={2.2} className="text-white" aria-hidden /></span>
          <div><div className="eyebrow text-ink-faint">Voice session</div><div className="text-sm font-semibold">{question.conceptName}</div></div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-needswork-line bg-needswork-bg px-3 py-[5px] text-xs text-ink-3"><span className="br size-2 rounded-full bg-needswork" />LIVE {clock(seconds)}</div>
        <Link href={`/course/${courseId}`} aria-label="Exit session" className={cn(buttonStyles({ variant: "secondary" }), "size-9 p-0")}><X size={14} strokeWidth={2.2} aria-hidden /></Link>
      </header>

      <main className={cn("flex min-h-0 flex-1 items-center justify-center px-8 py-5", showing && "gap-10")}>
        {phase === "review" ? (
          <section aria-label="Check what I heard" className="flex w-[640px] flex-col gap-3 rounded-md border border-line p-5">
            <h2 className="m-0 text-lg font-semibold">Check what I heard</h2>
            <p className="m-0 text-[13px] text-ink-muted">Fix any words I got wrong. This text is what gets graded.</p>
            <textarea aria-label="Transcript" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} className="resize-none rounded-sm border border-line p-3 text-sm leading-[1.55] outline-none" />
            {error && <div role="alert" className="text-xs text-needswork-text">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setPhase("tutor"); setPrompt("Keep going whenever you're ready."); }} disabled={busy}>Keep talking</Button>
              <Button onClick={submit} disabled={busy || !draft.trim()}>{busy ? "Checking your reasoning..." : "Submit"}</Button>
            </div>
          </section>
        ) : (
          <>
            <div className="flex w-[300px] shrink-0 flex-col items-center gap-[22px] text-center">
              <Orb
                state={orb} size={showing ? 190 : 270}
                label={phase === "tutor" ? "Interrupt the tutor" : "Hand the turn to the tutor"}
                onClick={() => { if (phase === "tutor") { speechSynthesis?.cancel(); listen(); } else review(); }}
              />
              <div aria-live="polite" className="flex flex-col gap-1.5">
                <div className="text-2xl font-semibold tracking-tight">{status}</div>
                <div className="text-sm leading-[1.45] text-ink-muted">{hint}</div>
                {error && <div role="alert" className="text-xs text-needswork-text">{error}</div>}
              </div>
            </div>
            {showing && (
              <section aria-label="What the tutor can see" className={cn("flex w-[600px] shrink-0 flex-col gap-3 rounded-md border bg-surface p-4", offTopic ? "border-needswork-line" : "border-line-soft")}>
                <div className="flex items-center justify-between gap-3">
                  <div className={cn("flex items-center gap-2 text-sm font-semibold", offTopic ? "text-needswork-text" : "text-ink")}>
                    {offTopic ? <ShieldAlert size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
                    {offTopic ? "Upload not used" : "Tutor can see your upload"}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setShown(null)}>Stop showing</Button>
                </div>
                <div className="rounded-sm border border-line bg-surface-subtle p-4 text-[13px] text-ink-3">
                  <div className="font-semibold text-ink">{shown.name}</div>
                  <div className="mt-1">{offTopic ? shown.reason : `Read: ${shown.summary}`}</div>
                </div>
                <div className="text-xs text-ink-faint">Nothing you show is kept after the session.</div>
              </section>
            )}
          </>
        )}
      </main>

      {phase !== "review" && (
        <footer className="flex h-24 shrink-0 items-center justify-center gap-3.5 border-t border-line bg-surface-sidebar">
          <Link href={typeHref} aria-label="Switch to typing" className={cn(buttonStyles({ variant: "secondary" }), "size-12 rounded-full p-0")}><Keyboard size={18} strokeWidth={1.8} aria-hidden /></Link>
          {uploads.enabled && (
            <AddFileMenu
              conceptId={question.conceptId} demo={uploads.demo} onError={setError}
              onChecked={({ name, check }) => { setError(null); setShown({ name, ok: check.is_student_work && check.relevant, summary: check.summary, reason: check.reason || "That upload doesn't look like your own work." }); }}
            />
          )}
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} className={cn("flex size-[60px] cursor-pointer items-center justify-center rounded-full border", muted ? "border-needswork bg-needswork text-white" : "border-line bg-[#F2F2F2] text-ink")}>
            {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
          </button>
          <Button onClick={review} className="h-12 px-5" disabled={!spoken && !interim}>End and review</Button>
        </footer>
      )}
    </div>
  );
}
