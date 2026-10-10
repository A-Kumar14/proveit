"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, X } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { QuizResult, QuizStartResult } from "@proveit/lib/schemas";
import { buttonStyles } from "../Button";

type Phase = { name: "intro" } | { name: "loading" } | { name: "taking"; quiz: QuizStartResult; answers: (number | null)[]; at: number } | { name: "grading"; quiz: QuizStartResult; answers: (number | null)[] } | { name: "done"; quiz: QuizStartResult; result: QuizResult };

const LETTERS = ["A", "B", "C", "D"];

/** A self-check quiz. It gives a score and a review, and it never changes mastery or rank. */
export function QuizRunner({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPhase({ name: "loading" });
    setError(null);
    try {
      const quiz = await api.startQuiz(courseId);
      setPhase({ name: "taking", quiz, answers: quiz.questions.map(() => null), at: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the quiz. Retry.");
      setPhase({ name: "intro" });
    }
  }

  async function finish(quiz: QuizStartResult, answers: (number | null)[]) {
    setPhase({ name: "grading", quiz, answers });
    setError(null);
    try {
      setPhase({ name: "done", quiz, result: await api.submitQuiz(quiz.quizId, answers) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade the quiz. Retry.");
      setPhase({ name: "taking", quiz, answers, at: quiz.questions.length - 1 });
    }
  }

  if (phase.name === "intro" || phase.name === "loading") {
    const loading = phase.name === "loading";
    return (
      <section aria-label="Quiz" className="flex max-w-xl flex-col gap-4 rounded-md border border-line bg-surface p-6">
        <h2 className="m-0 text-lg font-semibold">Quiz on {courseName}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-normal text-ink-muted">
          <li>8 multiple-choice questions, built from the course notes and your uploaded files.</li>
          <li>Questions lean on the concepts you are weakest in.</li>
          <li>You get a score and a review of every answer. A quiz is practice, so it never changes your mastery or rank.</li>
        </ul>
        {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={start} disabled={loading} className={cn(buttonStyles(), "cursor-pointer")}>
            {loading && <LoaderCircle size={14} className="animate-spin" aria-hidden />}{loading ? "Building your quiz..." : error ? "Retry" : "Start quiz"}
          </button>
          <Link href={`/course/${courseId}/practice`} className={buttonStyles({ variant: "secondary" })}>Back to practice</Link>
        </div>
      </section>
    );
  }

  if (phase.name === "taking" || phase.name === "grading") {
    const { quiz, answers } = phase;
    const grading = phase.name === "grading";
    const at = phase.name === "taking" ? phase.at : quiz.questions.length - 1;
    const q = quiz.questions[at]!;
    const last = at === quiz.questions.length - 1;
    const answered = answers.filter((a) => a !== null).length;
    const go = (n: number) => setPhase({ name: "taking", quiz, answers, at: n });
    const choose = (i: number) => setPhase({ name: "taking", quiz, answers: answers.map((a, j) => (j === at ? i : a)), at });
    return (
      <section aria-label="Quiz" className="flex max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>Question {at + 1} of {quiz.questions.length} · {q.concept}</span>
          <span>{answered} answered</span>
        </div>
        <div className="flex gap-1" role="img" aria-label={`Question ${at + 1} of ${quiz.questions.length}`}>
          {quiz.questions.map((_, i) => <span key={i} className={cn("h-[3px] flex-1 rounded-full", i === at ? "bg-ink" : answers[i] !== null ? "bg-ink-faint" : "bg-surface-strong")} />)}
        </div>
        <fieldset disabled={grading} className="m-0 flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
          <legend className="sr-only">Question {at + 1}</legend>
          <p className="m-0 text-base font-semibold leading-normal">{q.prompt}</p>
          <div className="flex flex-col gap-2">
            {q.options.map((o, i) => (
              <label key={i} className={cn("flex cursor-pointer items-start gap-3 rounded-sm border px-3.5 py-3 text-sm leading-normal hover:bg-surface-hover", answers[at] === i ? "border-ink bg-surface-hover" : "border-line")}>
                <input type="radio" name={q.id} checked={answers[at] === i} onChange={() => choose(i)} className="mt-1 accent-ink" />
                <span className="w-4 shrink-0 font-semibold text-ink-muted">{LETTERS[i]}</span>
                <span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(at - 1)} disabled={at === 0 || grading} className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer")}><ArrowLeft size={14} aria-hidden />Back</button>
          {last ? (
            <button type="button" onClick={() => void finish(quiz, answers)} disabled={grading} className={cn(buttonStyles(), "cursor-pointer")}>
              {grading ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Check size={14} aria-hidden />}{grading ? "Grading..." : answered < quiz.questions.length ? `Finish with ${quiz.questions.length - answered} blank` : "Finish quiz"}
            </button>
          ) : (
            <button type="button" onClick={() => go(at + 1)} className={cn(buttonStyles(), "cursor-pointer")}>Next<ArrowRight size={14} aria-hidden /></button>
          )}
        </div>
      </section>
    );
  }

  const { result } = phase;
  return (
    <section aria-label="Quiz results" className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
        <div className="eyebrow">Your score</div>
        <div className="flex items-baseline gap-3"><span className="text-[32px] font-semibold leading-none tabular-nums">{result.score} / {result.total}</span><span className="text-sm text-ink-muted">{result.pct}%</span></div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {result.byConcept.map((c) => (
            <li key={c.concept} className="flex items-center gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{c.concept}</span>
              <span className="tabular-nums text-ink-muted">{c.right} of {c.total}</span>
              <span className="h-1.5 w-24 rounded-full bg-surface-active"><span className={cn("block h-full rounded-full", c.right === c.total ? "bg-mastered" : c.right === 0 ? "bg-needswork" : "bg-developing")} style={{ width: `${Math.round((c.right / c.total) * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-ink-faint">This quiz is practice. It does not change your mastery or rank. Use Test this concept to prove a concept.</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Review">
        {result.items.map((it, i) => {
          const right = it.picked === it.correct;
          return (
            <li key={it.id} className={cn("flex flex-col gap-2 rounded-md border bg-surface p-4", right ? "border-mastered-line" : "border-needswork-line")}>
              <div className="flex items-start gap-2">
                {right ? <Check size={16} className="mt-0.5 shrink-0 text-mastered-text" aria-label="Correct" /> : <X size={16} className="mt-0.5 shrink-0 text-needswork-text" aria-label="Incorrect" />}
                <div className="min-w-0"><div className="text-[11px] text-ink-faint">{i + 1}. {it.concept}</div><div className="text-sm font-semibold leading-normal">{it.prompt}</div></div>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                {it.options.map((o, j) => (
                  <li key={j} className={cn("rounded-sm px-2.5 py-1.5", j === it.correct ? "bg-mastered-bg text-mastered-text" : j === it.picked ? "bg-needswork-bg text-needswork-text" : "text-ink-muted")}>
                    <span className="mr-2 font-semibold">{LETTERS[j]}</span>{o}{j === it.correct && <span className="ml-2 text-[11px] font-semibold">Correct answer</span>}{j === it.picked && j !== it.correct && <span className="ml-2 text-[11px] font-semibold">Your answer</span>}
                  </li>
                ))}
              </ul>
              {it.picked === null && <p className="m-0 text-xs text-ink-faint">You left this one blank.</p>}
              <p className="m-0 text-xs leading-normal text-ink-muted">{it.explanation}</p>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2">
        <button type="button" onClick={start} className={cn(buttonStyles(), "cursor-pointer")}>New quiz</button>
        <Link href={`/course/${courseId}/practice`} className={buttonStyles({ variant: "secondary" })}>Back to practice</Link>
      </div>
    </section>
  );
}
