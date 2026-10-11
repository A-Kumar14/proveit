"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@proveit/lib/api";
import { splitOptions } from "@proveit/lib/sessionText";
import { streamTutor } from "@proveit/lib/tutorStream";
import { cn } from "@proveit/lib/cn";
import type { QuestionView } from "@proveit/server/store";
import { AssistantCard } from "../chat/AssistantCard";
import { AssistantMessage } from "../chat/AssistantMessage";
import { Prose } from "../chat/Prose";
import { Typing } from "../chat/Typing";
import { UserBubble } from "../chat/UserBubble";
import { Composer, type Status } from "../shell/Composer";
import { Log } from "../shell/Log";
import { ClarificationCard } from "./QuestionCard";

/**
 * The thread, in order. `chat` turns are a conversation and are never graded. `check` is the one graded question,
 * asked only when the student chooses to be checked. `answer` is their reply to it, with any follow-up.
 */
type Item =
  | { id: number; kind: "chat"; role: "user" | "assistant"; text: string }
  | { id: number; kind: "check"; text: string }
  | { id: number; kind: "answer"; answer: string; followUp: string };
type Saved = { items: Item[]; mode: "chat" | "check"; followUpTo?: string };

const DONT_KNOW = "I don't know yet";
const KEEP_TALKING = /^keep talking/i;
const CHECK_NOW = /^check what i['’]?ve got/i;
const STUCK = /^(i don['’]?t know|i['’]?m (still )?(stuck|not sure|lost))/i;

/** Quick replies may offer the check or a menu after the student said they're stuck. Anything else could be a possible answer, so it never shows. */
export function allowedOptions(options: string[], prevUser: string | undefined): string[] {
  if (options.some((o) => CHECK_NOW.test(o) || KEEP_TALKING.test(o))) return options.filter((o) => CHECK_NOW.test(o) || KEEP_TALKING.test(o));
  return prevUser && STUCK.test(prevUser) ? options : [];
}
const chip = "h-9 cursor-pointer rounded-full border px-3.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Test this concept, as a conversation first. The student says what they think, the tutor agrees or corrects, and a graded check comes only when they ask for it. */
export function SessionChat({ courseId, question, opening, resume }: {
  courseId: string; question: QuestionView; opening: string; resume?: { attemptId: string; answer: string; followUp: string };
}) {
  const router = useRouter();
  const storeKey = `proveit.session.${courseId}.${question.conceptId}`;
  const nextId = useRef(resume ? 4 : 2);
  const [items, setItems] = useState<Item[]>(() => {
    const first: Item = { id: 1, kind: "chat", role: "assistant", text: opening };
    return resume ? [first, { id: 2, kind: "check", text: question.prompt }, { id: 3, kind: "answer", answer: resume.answer, followUp: resume.followUp }] : [first];
  });
  const [mode, setMode] = useState<"chat" | "check">(resume ? "check" : "chat");
  const [followUpTo, setFollowUpTo] = useState(resume?.attemptId);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideChips, setHideChips] = useState<number | null>(null);
  const itemsRef = useRef(items);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const restored = useRef(Boolean(resume));
  const put = useCallback((next: Item[]) => { itemsRef.current = next; setItems(next); }, []);

  // Pick the conversation back up after a reload. Deferred, so the first render matches the server's.
  useEffect(() => {
    if (restored.current) return;
    const t = setTimeout(() => {
      restored.current = true;
      try {
        const saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as Saved | null;
        if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
          nextId.current = Math.max(...saved.items.map((i) => i.id)) + 1;
          put(saved.items);
          setMode(saved.mode === "check" ? "check" : "chat");
          setFollowUpTo(saved.followUpTo);
        }
      } catch { /* a private window or bad data: start fresh */ }
    }, 0);
    return () => clearTimeout(t);
  }, [storeKey, put]);
  useEffect(() => {
    if (!restored.current || replying) return;
    try { sessionStorage.setItem(storeKey, JSON.stringify({ items, mode, followUpTo } satisfies Saved)); } catch { /* storage is a convenience */ }
  }, [items, mode, followUpTo, replying, storeKey]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [items]);
  useEffect(() => () => abort.current?.abort(), []);

  /** One turn of conversation. The reply streams in. A failed turn is taken back, so the student can send it again. */
  async function say(text: string) {
    const user: Item = { id: nextId.current++, kind: "chat", role: "user", text };
    const reply: Item = { id: nextId.current++, kind: "chat", role: "assistant", text: "" };
    const before = itemsRef.current;
    put([...before, user, reply]);
    setDraft("");
    setReplying(true);
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    // The opening is part of the tutor's brief on the server, so only what came after it is sent.
    const history = [...before, user].flatMap((i) => (i.kind === "chat" && i.id !== 1 && i.text.trim() ? [{ role: i.role, text: i.text }] : []));
    try {
      const full = await streamTutor({ courseId, messages: history, files: [], signal: ctrl.signal, endpoint: "/api/session", fields: { conceptId: question.conceptId } },
        (soFar) => put(itemsRef.current.map((i) => (i.id === reply.id ? { ...i, text: soFar } : i))));
      if (!full.trim()) throw new Error("Your tutor sent an empty reply. Retry.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        put(before);
        setDraft(text === DONT_KNOW ? "" : text);
        setError(e instanceof Error ? e.message : "Your tutor didn't answer. Retry.");
      }
    } finally {
      setReplying(false);
    }
  }

  /** The graded question. It appears only now, when the student asks to be checked. */
  function startCheck() {
    abort.current?.abort();
    setReplying(false);
    setError(null);
    setMode("check");
    put([...itemsRef.current, { id: nextId.current++, kind: "check", text: question.prompt }]);
  }

  async function grade(answer: string) {
    setGrading(true);
    setError(null);
    try {
      const { attemptId, evaluation } = await api.assess({ courseId, conceptId: question.conceptId, answer, followUpTo });
      if (evaluation.verdict === "uncertain") {
        put([...itemsRef.current, { id: nextId.current++, kind: "answer", answer, followUp: evaluation.followUp ?? "Say a bit more." }]);
        setFollowUpTo(attemptId);
        setDraft("");
        return;
      }
      try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
      router.push(`/course/${courseId}/diagnosis/${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGrading(false);
    }
  }

  function submit() {
    const text = draft.trim();
    if (!text || replying || grading) return;
    if (mode === "check") void grade(text); else void say(text);
  }

  function pick(option: string, id: number) {
    setHideChips(id);
    if (CHECK_NOW.test(option)) startCheck();
    else if (!KEEP_TALKING.test(option)) void say(option);
  }

  const busy = replying || grading;
  const status: Status = busy ? "evaluating" : error ? "error" : "idle";
  const lastChat = [...items].reverse().find((i) => i.kind === "chat");
  const talked = items.some((i) => i.kind === "chat" && i.role === "user");
  return (
    <>
      <Log>
        {items.map((it) => {
          if (it.kind === "check") {
            return (
              <AssistantMessage key={it.id}>
                <AssistantCard ariaLabel="Check" label={`Check · ${question.conceptName}`} headline={<span className="text-base leading-normal">{it.text}</span>}>
                  <p className="m-0 px-[18px] py-3 text-[13px] text-ink-muted">Answer in your own words. This one is graded, and it moves your course map. You can keep talking first if you want.</p>
                </AssistantCard>
              </AssistantMessage>
            );
          }
          if (it.kind === "answer") {
            return (
              <div key={it.id} className="contents">
                <UserBubble>{it.answer}</UserBubble>
                <AssistantMessage><ClarificationCard text={it.followUp} /></AssistantMessage>
              </div>
            );
          }
          if (it.role === "user") return <UserBubble key={it.id}>{it.text}</UserBubble>;
          const split = splitOptions(it.text);
          const { text } = split;
          const prev = items[items.indexOf(it) - 1];
          const options = allowedOptions(split.options, prev && prev.kind === "chat" && prev.role === "user" ? prev.text : undefined);
          const showChips = it === lastChat && options.length > 0 && !busy && mode === "chat" && hideChips !== it.id;
          return (
            <AssistantMessage key={it.id}>
              {text
                ? <div className="w-fit max-w-[640px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-3"><Prose text={text} /></div>
                : <Typing />}
              {showChips && (
                <div role="group" aria-label="Quick replies" className="mt-2.5 flex flex-wrap gap-2">
                  {options.map((o) => <button key={o} type="button" onClick={() => pick(o, it.id)} className={cn(chip, "border-line bg-surface text-ink-3 hover:bg-surface-hover")}>{o}</button>)}
                </div>
              )}
            </AssistantMessage>
          );
        })}
        <div ref={end} />
      </Log>
      <Composer
        value={draft} onChange={setDraft} onSubmit={submit} status={status} error={error}
        placeholder={mode === "check" ? "Explain it in your own words" : talked ? "Reply to your tutor" : "Tell me what you think"}
        submitLabel={mode === "check" ? "Submit" : "Send"}
        loadingText={grading ? "Checking your reasoning..." : "Your tutor is replying..."}
        hint={mode === "check" ? "This answer is graded." : "Just talking. Nothing here is graded."}
        onTalk={() => router.push(`/course/${courseId}/practice/${question.conceptId}/talk`)}
        onStop={replying ? () => abort.current?.abort() : undefined}
        leading={mode === "check"
          ? <button type="button" onClick={() => { setMode("chat"); setError(null); }} disabled={busy} className={cn(chip, "border-line bg-surface font-medium text-ink-3 hover:bg-surface-hover")}>Keep talking</button>
          : (
            <>
              <button type="button" onClick={() => void say(DONT_KNOW)} disabled={busy} className={cn(chip, "border-line bg-surface font-medium text-ink-3 hover:bg-surface-hover")}>I don&apos;t know yet</button>
              {talked && <button type="button" onClick={startCheck} disabled={busy} className={cn(chip, "border-line-button bg-surface font-semibold text-ink hover:bg-surface-hover")}>Check what I&apos;ve got</button>}
            </>
          )}
      />
    </>
  );
}
