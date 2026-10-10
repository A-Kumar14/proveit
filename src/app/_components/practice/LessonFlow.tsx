"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Log } from "../shell/Log";
import { Composer, type Status } from "../shell/Composer";
import { AssistantMessage } from "../chat/AssistantMessage";
import { UserBubble } from "../chat/UserBubble";
import { AssistantCard } from "../chat/AssistantCard";
import { MicroLessonCard } from "./MicroLessonCard";
import { TransferQuestionCard } from "./TransferQuestionCard";
import { api } from "@proveit/lib/api";
import { useSettings } from "@proveit/lib/settings";
import type { RemediationView } from "@proveit/server/store";

export function LessonFlow({ r }: { r: RemediationView }) {
  const router = useRouter();
  const [settings] = useSettings();
  const [step, setStep] = useState<"learn" | "try">("learn");
  const [lessonOpen, setLessonOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState<{ answer: string; followUp: string }[]>([]);
  const learn = step === "learn";

  async function submit() {
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const res = await api.transfer(r.attemptId, answer);
      if (res.result === "pass") return router.push(`/course/${r.courseId}/result/${res.resultAttemptId}`);
      if (res.nextAttemptId) return router.push(`/course/${r.courseId}/diagnosis/${res.nextAttemptId}`);
      setMisses((m) => [...m, { answer, followUp: res.followUp ?? "Not there yet." }]);
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
          <MicroLessonCard
            lesson={r.lesson} conceptName={r.conceptName} open={learn || lessonOpen} toggleable={!learn}
            onToggle={() => setLessonOpen((o) => !o)} onGotIt={learn ? () => setStep("try") : undefined}
          />
        </AssistantMessage>
        {!learn && (
          <>
            <UserBubble>Got it, give me a new question</UserBubble>
            <AssistantMessage>
              <TransferQuestionCard question={r.transfer.question} hint={r.transfer.hint} showHint={hint} hintsEnabled={settings.showHints} onToggleHint={() => setHint((h) => !h)} />
            </AssistantMessage>
            {misses.map((m, i) => (
              <div key={i} className="contents">
                <UserBubble>{m.answer}</UserBubble>
                <AssistantMessage>
                  <AssistantCard ariaLabel="Not yet" label="Not yet" headline="That doesn't show the idea yet.">
                    <div className="px-[18px] py-3 text-[13px] leading-normal text-ink-2">{m.followUp}</div>
                  </AssistantCard>
                </AssistantMessage>
              </div>
            ))}
          </>
        )}
      </Log>
      {!learn && (
        <Composer value={answer} onChange={setAnswer} onSubmit={submit} status={status} error={error} placeholder="Your answer" loadingText="Checking if it transfers..." />
      )}
    </>
  );
}
