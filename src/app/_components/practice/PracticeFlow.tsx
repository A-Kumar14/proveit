"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Log } from "../shell/Log";
import { Composer, type Status } from "../shell/Composer";
import { AssistantMessage } from "../chat/AssistantMessage";
import { UserBubble } from "../chat/UserBubble";
import { ClarificationCard, QuestionCard } from "./QuestionCard";
import { api } from "@proveit/lib/api";
import type { QuestionView } from "@proveit/server/store";

type Turn = { answer: string; followUp: string };

export function PracticeFlow({ courseId, question, resume }: { courseId: string; question: QuestionView; resume?: { attemptId: string; answer: string; followUp: string } }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(resume ? [{ answer: resume.answer, followUp: resume.followUp }] : []);
  const [followUpTo, setFollowUpTo] = useState(resume?.attemptId);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const { attemptId, evaluation } = await api.assess({ courseId, conceptId: question.conceptId, answer, followUpTo });
      if (evaluation.verdict === "uncertain") {
        setTurns((t) => [...t, { answer, followUp: evaluation.followUp ?? "Say a bit more." }]);
        setFollowUpTo(attemptId);
        setAnswer("");
        setStatus("idle");
        return;
      }
      router.push(`/course/${courseId}/diagnosis/${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <>
      <Log>
        <AssistantMessage><QuestionCard conceptName={question.conceptName} prompt={question.prompt} why={question.why} /></AssistantMessage>
        {turns.map((t, i) => (
          <div key={i} className="contents">
            <UserBubble>{t.answer}</UserBubble>
            <AssistantMessage><ClarificationCard text={t.followUp} /></AssistantMessage>
          </div>
        ))}
      </Log>
      <Composer value={answer} onChange={setAnswer} onSubmit={submit} status={status} error={error} placeholder={turns.length ? "Your next answer" : "Explain it in your own words"} />
    </>
  );
}
