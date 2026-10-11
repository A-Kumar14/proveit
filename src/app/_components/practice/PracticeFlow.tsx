"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettings } from "@proveit/lib/settings";
import { useVoiceSupport } from "../voice/speech";
import { TalkSession } from "../voice/TalkSession";
import { Typing } from "../chat/Typing";
import { Log } from "../shell/Log";
import { Composer, type Status } from "../shell/Composer";
import { AssistantMessage } from "../chat/AssistantMessage";
import { UserBubble } from "../chat/UserBubble";
import { ClarificationCard, QuestionCard } from "./QuestionCard";
import { AddFileMenu } from "../upload/AddFileMenu";
import { UploadReply, type UploadState } from "../upload/UploadReply";
import { Paperclip, X } from "lucide-react";
import { api } from "@proveit/lib/api";
import type { QuestionView } from "@proveit/server/store";

type Turn = { answer: string; followUp: string };

export function PracticeFlow({ courseId, question, resume, uploads, modeParam }: {
  courseId: string; question: QuestionView; resume?: { attemptId: string; answer: string; followUp: string }; uploads: { enabled: boolean; demo: boolean }; modeParam?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const canTalk = useVoiceSupport();
  const [settings] = useSettings();
  const [turns, setTurns] = useState<Turn[]>(resume ? [{ answer: resume.answer, followUp: resume.followUp }] : []);
  const [followUpTo, setFollowUpTo] = useState(resume?.attemptId);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [talking, setTalking] = useState(false);

  // "Answer by: Talk" in Settings opens voice mode first, unless the student just chose typing.
  useEffect(() => {
    if (settings.answerMode === "talk" && canTalk && !modeParam && !resume) router.replace(`${pathname}?mode=speak`);
  }, [settings.answerMode, canTalk, modeParam, resume, router, pathname]);

  /** "I don't know yet" is a signal, not a wrong answer. The tutor asks a smaller question instead of diagnosing. */
  function dontKnow() {
    setTurns((t) => [...t, { answer: "I don't know yet", followUp: question.probe }]);
    setAnswer("");
    setError(null);
  }

  async function submit() {
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const { attemptId, evaluation } = await api.assess({ courseId, conceptId: question.conceptId, learningSpecRevision: question.learningSpecRevision, answer, followUpTo, imageSummary: upload?.ok ? upload.summary : undefined, imageName: upload?.ok ? upload.name : undefined });
      if (evaluation.verdict === "uncertain") {
        setTurns((t) => [...t, { answer, followUp: evaluation.followUp ?? "Say a bit more." }]);
        setFollowUpTo(attemptId);
        setAnswer("");
        setUpload(null);
        setStatus("idle");
        return;
      }
      router.push(`/course/${courseId}/diagnosis/${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (talking) return <TalkSession courseId={courseId} question={question} onExit={() => setTalking(false)} />;

  return (
    <>
      <Log>
        <AssistantMessage><QuestionCard conceptName={question.conceptName} prompt={question.prompt} why={question.why} source={question.source} sources={question.sources} /></AssistantMessage>
        {turns.map((t, i) => (
          <div key={i} className="contents">
            <UserBubble>{t.answer}</UserBubble>
            <AssistantMessage><ClarificationCard text={t.followUp} /></AssistantMessage>
          </div>
        ))}
        {status === "evaluating" && <AssistantMessage><Typing /></AssistantMessage>}
        {upload && <UploadReply upload={upload} onRetry={() => { setUpload(null); document.querySelector<HTMLInputElement>("input[type=file]")?.click(); }} onDismiss={() => setUpload(null)} />}
      </Log>
      <Composer
        value={answer} onChange={setAnswer} onSubmit={submit} status={status} error={error}
        placeholder={turns.length ? "Your next answer" : "Explain it in your own words"}
        onTalk={() => setTalking(true)} talkUnavailable={!canTalk}
        leading={(
          <>
            {uploads.enabled && <AddFileMenu
              iconOnly courseId={courseId} conceptId={question.conceptId} demo={uploads.demo} disabled={status === "evaluating"}
              onError={(m) => { setError(m); }}
              onChecked={({ name, check }) => { setError(null); setUpload({ name, ok: check.is_student_work && check.relevant, summary: check.summary, reason: check.reason || "That upload doesn't look like your own work on this question." }); }}
            />}
            <button type="button" onClick={dontKnow} disabled={status === "evaluating"} className="h-9 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50">I don&apos;t know yet</button>
          </>
        )}
        chip={upload?.ok && (
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-mastered-line bg-mastered-bg px-2.5 py-0.5 text-[0.6875rem] text-mastered-text">
            <Paperclip size={11} strokeWidth={2.2} aria-hidden />{upload.name} · read as your work
            <button type="button" aria-label="Remove file" onClick={() => setUpload(null)} className="flex cursor-pointer border-0 bg-transparent p-0 text-mastered-text"><X size={11} aria-hidden /></button>
          </span>
        )}
      />
    </>
  );
}

