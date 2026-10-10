"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Camera, CheckCircle2, Keyboard, Mic, MicOff, Pen, ShieldAlert, X } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { QuestionView } from "@proveit/server/store";
import { Button, buttonStyles } from "../Button";
import { AddFileMenu } from "../upload/AddFileMenu";
import { CameraCapture } from "./CameraCapture";
import { Orb, type OrbState } from "./Orb";
import { SketchPad } from "./SketchPad";
import { useSettings } from "@proveit/lib/settings";
import { createRecognition, speak, useVoiceSupport, type Recognition } from "./speech";

type Phase = "tutor" | "listening" | "review";
type Shown = { name: string; ok: boolean; summary: string; reason: string };
type Tool = "sketch" | "camera" | null;
const MAX_TURNS = 4;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VoiceSession({ courseId, question, typeHref, uploads }: { courseId: string; question: QuestionView; typeHref: string; uploads: { enabled: boolean } }) {
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
  const [tool, setTool] = useState<Tool>(null);
  const [turn, setTurn] = useState(1);
  const [checking, setChecking] = useState(false);
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

  /** Sketch and camera frames go through the same upload check as a picked file. */
  async function checkFile(file: File) {
    setChecking(true);
    setError(null);
    try {
      const c = await api.checkUpload(file, question.conceptId);
      setShown({ name: file.name, ok: c.is_student_work && c.relevant, summary: c.summary, reason: c.reason || "That doesn't look like your own work on this question." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload check failed. Retry.");
    }
    setChecking(false);
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
      setTurn((t) => Math.min(t + 1, MAX_TURNS));
      setPhase("tutor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  }

  const offTopic = shown !== null && !shown.ok;
  const panelOpen = tool !== null || shown !== null;
  const orb: OrbState = muted ? "muted" : phase === "tutor" || offTopic ? "tutor" : "listening";
  const status = muted ? "Mic paused" : offTopic ? 'Tutor: "Show me your own work"' : phase === "tutor" ? "Tutor is asking" : panelOpen ? "Listening and watching" : "Listening";
  const hint = muted ? "Unmute when you are ready to keep explaining."
    : offTopic ? shown.reason
    : phase === "tutor" ? prompt
    : panelOpen ? "Talk while you work. The tutor follows along." : "Explain it like you would to a classmate.";
  const seg = (on: boolean) => cn("flex h-10 cursor-pointer items-center gap-1.5 rounded-sm border px-3.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50", on ? "border-line-button bg-surface-hover font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-3 hover:bg-surface-hover");
  const toggleTool = (t: Exclude<Tool, null>) => { setTool((cur) => (cur === t ? null : t)); setShown(null); setError(null); };

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
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 text-sm">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink"><BarChart3 size={16} strokeWidth={2.2} className="text-white" aria-hidden /></span>
          <Link href={`/course/${courseId}`} className="text-ink-muted no-underline hover:text-ink">{question.courseName}</Link>
          <span className="text-ink-faint" aria-hidden>/</span>
          <span className="text-ink-muted">{question.conceptName}</span>
          <span className="text-ink-faint" aria-hidden>/</span>
          <span className="font-semibold" aria-current="page">Voice session</span>
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-line px-3 py-[5px] text-[13px] text-ink-3"><span className="br size-2 rounded-full bg-needswork" />Live · {clock(seconds)}</div>
          <Link href={`/course/${courseId}`} aria-label="Exit session" className={cn(buttonStyles({ variant: "secondary" }), "size-10 p-0")}><X size={16} strokeWidth={2.2} aria-hidden /></Link>
        </div>
      </header>

      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface-subtle px-6 text-sm">
        <div className="flex min-w-0 items-baseline gap-3"><span className="text-ink-muted">Explaining</span><span className="truncate font-medium">{question.prompt}</span></div>
        <div className="flex shrink-0 items-center gap-2.5 text-ink-muted" role="img" aria-label={`Turn ${turn} of ${MAX_TURNS}`}>
          Turns
          <span className="flex gap-1.5" aria-hidden>{Array.from({ length: MAX_TURNS }, (_, i) => <span key={i} className={cn("h-[3px] w-8 rounded-full", i < turn ? "bg-ink" : "bg-surface-strong")} />)}</span>
        </div>
      </div>

      <main className={cn("flex min-h-0 flex-1 items-center justify-center px-8 py-5", panelOpen && "gap-10")}>
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
                state={orb} size={panelOpen ? 190 : 270}
                label={phase === "tutor" ? "Interrupt the tutor" : "Hand the turn to the tutor"}
                onClick={() => { if (phase === "tutor") { speechSynthesis?.cancel(); listen(); } else review(); }}
              />
              <div aria-live="polite" className="flex flex-col gap-1.5">
                <div className="text-2xl font-semibold tracking-tight">{status}</div>
                <div className="text-sm leading-[1.45] text-ink-muted">{hint}</div>
                {error && <div role="alert" className="text-xs text-needswork-text">{error}</div>}
              </div>
            </div>
            {panelOpen && (
              <section aria-label="What the tutor can see" className={cn("flex w-[600px] shrink-0 flex-col gap-3 rounded-md border bg-surface p-4", offTopic ? "border-needswork-line" : "border-line-soft")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{tool === "sketch" ? "Sketch for the tutor" : tool === "camera" ? "Camera" : "Your upload"}</div>
                  <Button size="sm" variant="secondary" onClick={() => { setTool(null); setShown(null); }}>Stop showing</Button>
                </div>
                {tool === "sketch" && <SketchPad onShow={checkFile} busy={checking} />}
                {tool === "camera" && <CameraCapture onShow={checkFile} busy={checking} />}
                {shown && (
                  <div role={offTopic ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-sm border p-3 text-[13px]", offTopic ? "border-needswork-line bg-needswork-bg text-ink-2" : "border-mastered-line bg-mastered-bg text-ink-2")}>
                    {offTopic ? <ShieldAlert size={16} className="mt-px shrink-0 text-needswork-text" aria-hidden /> : <CheckCircle2 size={16} className="mt-px shrink-0 text-mastered-text" aria-hidden />}
                    <span><span className="font-semibold">{offTopic ? `Upload not used · ${shown.name}` : `${shown.name} · tutor can see it`}</span><br />{offTopic ? shown.reason : `Read: ${shown.summary}`}</span>
                  </div>
                )}
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
            <div role="group" aria-label="Show the tutor" className="flex gap-1 rounded-md border border-line bg-surface p-1">
              <button type="button" className={seg(tool === "sketch")} aria-pressed={tool === "sketch"} onClick={() => toggleTool("sketch")}><Pen size={14} strokeWidth={1.8} aria-hidden />Sketch</button>
              <button type="button" className={seg(tool === "camera")} aria-pressed={tool === "camera"} onClick={() => toggleTool("camera")}><Camera size={14} strokeWidth={1.8} aria-hidden />Camera</button>
              <AddFileMenu
                conceptId={question.conceptId} onError={setError} buttonClassName={seg(false)}
                onChecked={({ name, check }) => { setTool(null); setError(null); setShown({ name, ok: check.is_student_work && check.relevant, summary: check.summary, reason: check.reason || "That upload doesn't look like your own work." }); }}
              />
            </div>
          )}
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"} aria-pressed={muted} className={cn("flex size-[60px] cursor-pointer items-center justify-center rounded-full border", muted ? "border-needswork bg-needswork text-white" : "border-line bg-[#F2F2F2] text-ink")}>
            {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
          </button>
          <Button onClick={review} className="h-12 px-5" disabled={!spoken && !interim}>End and review<ArrowRight size={16} strokeWidth={2} aria-hidden /></Button>
        </footer>
      )}
    </div>
  );
}
