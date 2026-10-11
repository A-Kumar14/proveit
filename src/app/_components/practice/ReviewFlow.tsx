"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@proveit/lib/api";
import { useSettings } from "@proveit/lib/settings";
import type { ReviewChallengeView } from "@proveit/server/store";
import { AssistantCard } from "../chat/AssistantCard";
import { AssistantMessage } from "../chat/AssistantMessage";
import { UserBubble } from "../chat/UserBubble";
import { Composer, type Status } from "../shell/Composer";
import { Log } from "../shell/Log";
import { TransferQuestionCard } from "./TransferQuestionCard";

export function ReviewFlow({ r }: { r: ReviewChallengeView }) {
  const router = useRouter();
  const [settings] = useSettings();
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<{ answer: string; followUp: string }[]>([]);

  async function submit() {
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const res = r.learningSpecRevision === undefined
        ? await api.review(r.courseId, r.conceptId, answer)
        : await api.review(r.courseId, r.conceptId, answer, r.learningSpecRevision);
      if (res.result === "pass") return router.push(`/course/${r.courseId}/review-result/${res.resultAttemptId}`);
      if (res.result === "fail") return router.push(`/course/${r.courseId}/diagnosis/${res.nextAttemptId}`);
      setUncertain((rows) => [...rows, { answer, followUp: res.followUp }]);
      setAnswer("");
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <>
      <Log>
        <AssistantMessage>
          <TransferQuestionCard
            sources={r.review.sources} question={r.review.question}
            hint={r.review.hint}
            showHint={hint}
            hintsEnabled={settings.showHints}
            onToggleHint={() => setHint((h) => !h)}
            label="Delayed review"
            headline="Can you still retrieve it?"
            description="No lesson first. This check is delayed on purpose: retaining the idea later is stronger evidence than recognizing it immediately."
          />
        </AssistantMessage>
        {uncertain.map((row, i) => (
          <div key={i} className="contents">
            <UserBubble>{row.answer}</UserBubble>
            <AssistantMessage>
              <AssistantCard ariaLabel="Need more evidence" label="Need more evidence" headline="Your mastery state stays unchanged.">
                <div className="px-[18px] py-3 text-[0.8125rem] leading-normal text-ink-2">{row.followUp}</div>
              </AssistantCard>
            </AssistantMessage>
          </div>
        ))}
      </Log>
      <Composer value={answer} onChange={setAnswer} onSubmit={submit} status={status} error={error} placeholder="Answer from memory" loadingText="Checking retention..." />
    </>
  );
}

