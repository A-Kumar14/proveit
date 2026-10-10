"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettings } from "@proveit/lib/settings";
import { useVoiceSupport } from "../voice/speech";
import { TalkSession } from "../voice/TalkSession";
import { Prose } from "../chat/Prose";
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
import { streamTutor } from "@proveit/lib/tutorStream";
import type { QuestionView } from "@proveit/server/store";

/** The thread, in the order it happened: answers the student gave, and the guided chat before they were ready to answer. */
type Item = { id: number; kind: "answer"; answer: string; followUp: string } | { id: number; kind: "guide"; role: "user" | "assistant"; text: string };

export function PracticeFlow({ courseId, question, resume, uploads, modeParam, guide = false }: {
  courseId: string; question: QuestionView; resume?: { attemptId: string; answer: string; followUp: string }; uploads: { enabled: boolean }; modeParam?: string;
  /** True when a model is available, so "I don't know yet" can open a guided chat instead of a fixed question. */
  guide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const canTalk = useVoiceSupport();
  const [settings] = useSettings();
  const nextId = useRef(2);
  const [items, setItems] = useState<Item[]>(resume ? [{ id: 1, kind: "answer", answer: resume.answer, followUp: resume.followUp }] : []);
  // Guided mode: the student is talking with the tutor, and nothing they type is graded.
  const [guided, setGuided] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const itemsRef = useRef(items);
  const put = (next: Item[]) => { itemsRef.current = next; setItems(next); };
  useEffect(() => () => abort.current?.abort(), []);
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

  /**
   * "I don't know yet" is a signal, not a wrong answer. With a model, the tutor guides the student a step at a time
   * until they are ready to try. Without one, it falls back to a single smaller question.
   */
  async function dontKnow() {
    setError(null);
    if (!guide) {
      put([...itemsRef.current, { id: nextId.current++, kind: "answer", answer: "I don't know yet", followUp: question.probe }]);
      setAnswer("");
      return;
    }
    setGuided(true);
    const asked = itemsRef.current.some((i) => i.kind === "guide");
    await sendGuide(asked ? "I'm still stuck. Can you help me a bit more?" : "I don't know yet");
  }

  /** One turn of the guided chat. The reply streams in. A failed turn is taken back so the student can resend it. */
  async function sendGuide(text: string) {
    const user: Item = { id: nextId.current++, kind: "guide", role: "user", text };
    const reply: Item = { id: nextId.current++, kind: "guide", role: "assistant", text: "" };
    const before = itemsRef.current;
    put([...before, user, reply]);
    setAnswer("");
    setGuiding(true);
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const history = [...before, user].flatMap((i) => (i.kind === "guide" && i.text.trim() ? [{ role: i.role, text: i.text }] : []));
    try {
      const full = await streamTutor({ courseId, messages: history, files: [], signal: ctrl.signal, endpoint: "/api/guide", fields: { conceptId: question.conceptId } },
        (soFar) => put(itemsRef.current.map((i) => (i.id === reply.id ? { ...i, text: soFar } : i))));
      if (!full.trim()) throw new Error("Your tutor sent an empty reply. Retry.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        put(before);
        setAnswer(text === "I don't know yet" || text.startsWith("I'm still stuck") ? "" : text);
        setError(e instanceof Error ? e.message : "Your tutor didn't answer. Retry.");
      }
    } finally {
      setGuiding(false);
    }
  }

  /** The student is done being guided and will answer the question. */
  function ready() {
    abort.current?.abort();
    setGuided(false);
    setGuiding(false);
    setError(null);
  }

  async function submit() {
    if (guided) return void (!guiding && answer.trim() && sendGuide(answer.trim()));
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const { attemptId, evaluation } = await api.assess({ courseId, conceptId: question.conceptId, answer, followUpTo, imageSummary: upload?.ok ? upload.summary : undefined, imageName: upload?.ok ? upload.name : undefined });
      if (evaluation.verdict === "uncertain") {
        put([...itemsRef.current, { id: nextId.current++, kind: "answer", answer, followUp: evaluation.followUp ?? "Say a bit more." }]);
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
        <AssistantMessage><QuestionCard conceptName={question.conceptName} prompt={question.prompt} why={question.why} source={question.source} /></AssistantMessage>
        {items.map((it) => it.kind === "answer" ? (
          <div key={it.id} className="contents">
            <UserBubble>{it.answer}</UserBubble>
            <AssistantMessage><ClarificationCard text={it.followUp} /></AssistantMessage>
          </div>
        ) : it.role === "user" ? (
          <UserBubble key={it.id}>{it.text}</UserBubble>
        ) : (
          <AssistantMessage key={it.id}>
            {it.text
              ? <div className="w-fit max-w-[640px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-3"><Prose text={it.text} /></div>
              : <Typing />}
          </AssistantMessage>
        ))}
        {status === "evaluating" && <AssistantMessage><Typing /></AssistantMessage>}
        {upload && <UploadReply upload={upload} onRetry={() => { setUpload(null); document.querySelector<HTMLInputElement>("input[type=file]")?.click(); }} onDismiss={() => setUpload(null)} />}
      </Log>
      <Composer
        value={answer} onChange={setAnswer} onSubmit={submit} status={guiding || status === "evaluating" ? "evaluating" : error ? "error" : "idle"} error={error}
        placeholder={guided ? "Reply to your tutor" : items.some((i) => i.kind === "answer") ? "Your next answer" : "Explain it in your own words"}
        submitLabel={guided ? "Send" : "Submit"} loadingText={guiding ? "Your tutor is replying..." : undefined}
        hint={guided ? "Chatting with your tutor. Nothing here is graded." : undefined}
        onStop={guiding ? () => abort.current?.abort() : undefined}
        onTalk={guided ? undefined : () => setTalking(true)} talkUnavailable={!canTalk}
        leading={(
          <>
            {!guided && uploads.enabled && <AddFileMenu
              iconOnly conceptId={question.conceptId} disabled={status === "evaluating"}
              onError={(m) => { setError(m); }}
              onChecked={({ name, check }) => { setError(null); setUpload({ name, ok: check.is_student_work && check.relevant, summary: check.summary, reason: check.reason || "That upload doesn't look like your own work on this question." }); }}
            />}
            {guided
              ? <button type="button" onClick={ready} className="h-9 cursor-pointer rounded-full border border-line-button bg-surface px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-hover">I&apos;m ready to answer</button>
              : <button type="button" onClick={() => void dontKnow()} disabled={status === "evaluating" || guiding} className="h-9 cursor-pointer rounded-full border border-line bg-surface px-3.5 text-xs font-medium text-ink-3 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50">I don&apos;t know yet</button>}
          </>
        )}
        chip={upload?.ok && (
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-mastered-line bg-mastered-bg px-2.5 py-0.5 text-[11px] text-mastered-text">
            <Paperclip size={11} strokeWidth={2.2} aria-hidden />{upload.name} · read as your work
            <button type="button" aria-label="Remove file" onClick={() => setUpload(null)} className="flex cursor-pointer border-0 bg-transparent p-0 text-mastered-text"><X size={11} aria-hidden /></button>
          </span>
        )}
      />
    </>
  );
}
