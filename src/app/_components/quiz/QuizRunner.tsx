"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { QuizResult, QuizStartResult } from "@proveit/lib/schemas";
import { buttonStyles } from "../Button";
import { QuizResultView } from "./QuizResultView";

type Phase = { name: "intro" } | { name: "loading" } | { name: "taking"; quiz: QuizStartResult; answers: (number | null)[]; at: number } | { name: "grading"; quiz: QuizStartResult; answers: (number | null)[] } | { name: "done"; quiz: QuizStartResult; result: QuizResult };

const LETTERS = ["A", "B", "C", "D"];

/** A self-check quiz. It gives a score and a review, and it never changes mastery or rank. */
export function QuizRunner({ courseId, courseName, conceptId, conceptName }: { courseId: string; courseName: string; conceptId?: string; conceptName?: string }) {
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPhase({ name: "loading" });
    setError(null);
    try {
      const quiz = await api.startQuiz(courseId, undefined, conceptId);
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
        <h2 className="m-0 text-lg font-semibold">{conceptName ? `Quiz on ${conceptName}` : `Quiz on ${courseName}`}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] leading-normal text-ink-muted">
          <li>{conceptName ? "4 multiple-choice questions on this one concept" : "8 multiple-choice questions"}, built from the course notes and your uploaded files.</li>
          {!conceptName && <li>Questions lean on the concepts you are weakest in.</li>}
          <li>You get a score and a review of every answer, saved to your History.</li>
          <li>Each question counts toward its concept on the course map. A quiz can start a concept or flag one that is going badly, and it earns a few rank points. Proving a concept still takes a new-question test.</li>
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

  return <QuizResultView result={phase.result} onRetake={start} />;
}
