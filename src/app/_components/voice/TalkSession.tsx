"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { AuditResult, Turn } from "@proveit/lib/schemas";
import type { QuestionView } from "@proveit/server/store";
import { AssistantMessage } from "../chat/AssistantMessage";
import { AuditCard } from "../chat/AuditCard";
import { Typing } from "../chat/Typing";
import { UserBubble } from "../chat/UserBubble";
import { Log } from "../shell/Log";
import { speak } from "./speech";
import { useDictation } from "./useDictation";
import { VoiceDock } from "./VoiceDock";

type Phase = "speaking" | "listening" | "thinking" | "done";
const SILENCE_MS = 2500;
const LABEL: Record<Phase, string> = { speaking: "Tutor is talking", listening: "Listening", thinking: "Thinking", done: "Session finished" };

/** A spoken to-and-fro inside the chat. The tutor asks, the student talks, the tutor digs in, then an audit closes it. */
export function TalkSession({ courseId, question, onExit }: { courseId: string; question: QuestionView; onExit: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([{ role: "ai", text: question.prompt }]);
  const [phase, setPhase] = useState<Phase>("speaking");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const turnsRef = useRef(turns);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finish = useRef<() => void>(() => {});
  const [failed, setFailed] = useState<null | "ask" | "audit">(null);

  const arm = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => finish.current(), SILENCE_MS); }, []);
  const dictation = useDictation(arm);
  const { start, stop, take, text, blocked } = dictation;

  const push = useCallback((t: Turn) => { turnsRef.current = [...turnsRef.current, t]; setTurns(turnsRef.current); }, []);

  const listen = useCallback(() => { setPhase("listening"); setError(null); take(); start(); }, [start, take]);

  /** The tutor speaks, then the mic opens. If speech never starts (blocked or unsupported) the mic opens anyway. */
  const say = useCallback((line: string) => {
    setPhase("speaking");
    stop();
    let started = false;
    const guard = setTimeout(() => { if (!started) { speechSynthesis?.cancel(); listen(); } }, 1500);
    speak(line, () => { started = true; clearTimeout(guard); }, () => { clearTimeout(guard); listen(); });
  }, [listen, stop]);

  const runAudit = useCallback(async () => {
    setPhase("thinking");
    setError(null);
    setFailed(null);
    try {
      const a = await api.audit({ courseId, conceptId: question.conceptId, turns: turnsRef.current });
      setAuditResult(a);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The audit failed. Retry.");
      setFailed("audit");
    }
  }, [courseId, question.conceptId]);

  const ask = useCallback(async () => {
    setPhase("thinking");
    setError(null);
    setFailed(null);
    try {
      const r = await api.converse({ courseId, conceptId: question.conceptId, turns: turnsRef.current });
      if (r.kind === "done") return void runAudit();
      push({ role: "ai", text: r.text });
      say(r.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The tutor didn't answer. Retry.");
      setFailed("ask");
    }
  }, [courseId, question.conceptId, push, say, runAudit]);

  useEffect(() => {
    finish.current = () => {
      clearTimeout(timer.current);
      const said = take();
      if (!said) return;
      stop();
      push({ role: "student", text: said });
      void ask();
    };
  });

  // Read the opening question on mount. Deferred so the first render doesn't set state inside the effect.
  useEffect(() => {
    const t = setTimeout(() => say(question.prompt), 0);
    return () => { clearTimeout(t); clearTimeout(timer.current); stop(); speechSynthesis?.cancel(); };
  }, [question.prompt, say, stop]);

  function toggleMute() {
    if (muted) { setMuted(false); if (phase === "listening") start(); }
    else { setMuted(true); clearTimeout(timer.current); stop(); }
  }

  function again() {
    turnsRef.current = [{ role: "ai", text: question.prompt }];
    setTurns(turnsRef.current);
    setAuditResult(null);
    say(question.prompt);
  }

  const active = phase === "listening" && !muted;
  return (
    <>
      <Log>
        {turns.map((t, i) => t.role === "ai"
          ? <AssistantMessage key={i}><div className={cn("w-fit max-w-[640px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-2.5 text-sm leading-normal", i === 0 && "font-semibold")}>{t.text}</div></AssistantMessage>
          : <div key={i} className="contents"><UserBubble>{t.text}</UserBubble></div>)}
        {active && text && <UserBubble className="opacity-60">{text}</UserBubble>}
        {phase === "thinking" && !error && <AssistantMessage><Typing /></AssistantMessage>}
        {auditResult && <AssistantMessage><AuditCard conceptName={question.conceptName} audit={auditResult} nextHref={`/course/${courseId}/diagnosis/${auditResult.attemptId}`} onAgain={again} /></AssistantMessage>}
      </Log>
      <VoiceDock
        muted={muted} onToggleMute={toggleMute} waving={phase === "speaking" || active}
        onExit={() => { stop(); speechSynthesis?.cancel(); onExit(); }}
        status={error ? <span className="text-needswork-text">{error}</span>
          : blocked ? <span className="text-needswork-text">The microphone is blocked. Allow it in your browser, or type instead.</span>
          : <span className="text-ink-muted">{muted ? "Mic paused" : LABEL[phase]}</span>}
        actions={(
          <>
            {error && failed && <button type="button" onClick={() => void (failed === "audit" ? runAudit() : ask())} className="h-9 cursor-pointer rounded-full border border-line-button bg-surface px-3.5 text-xs font-semibold hover:bg-surface-hover">Retry</button>}
            {active && <button type="button" onClick={() => finish.current()} disabled={!text} className="h-9 cursor-pointer rounded-full border-0 bg-ink px-4 text-xs font-semibold text-white hover:bg-ink-3 disabled:cursor-not-allowed disabled:bg-surface-strong disabled:text-ink-faint">Done talking</button>}
            {phase === "listening" && turns.length >= 3 && !text && <button type="button" onClick={() => void runAudit()} className="h-9 cursor-pointer rounded-full border border-line-button bg-surface px-3.5 text-xs font-semibold hover:bg-surface-hover">End and audit</button>}
          </>
        )}
      />
    </>
  );
}
