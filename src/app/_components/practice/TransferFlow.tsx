"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Log } from "../shell/Log";
import { Composer, type Status } from "../shell/Composer";
import { AssistantMessage } from "../chat/AssistantMessage";
import { UserBubble } from "../chat/UserBubble";
import { AssistantCard } from "../chat/AssistantCard";
import { TransferQuestionCard } from "./TransferQuestionCard";
import { api } from "@proveit/lib/api";
import { useSettings } from "@proveit/lib/settings";
import type { TransferChallengeView } from "@proveit/server/store";

export function TransferFlow({ r }: { r: TransferChallengeView }) {
  const router = useRouter();
  const [settings] = useSettings();
  const [hint, setHint] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [misses, setMisses] = useState<{ answer: string; followUp: string }[]>([]);

  async function submit() {
    if (status === "evaluating" || !answer.trim()) return;
    setStatus("evaluating");
    setError(null);
    try {
      const res = await api.transfer(r.attemptId, answer);
      if (res.result === "pass") return router.push(`/course/${r.courseId}/result/${res.resultAttemptId}`);
      if (res.nextAttemptId) return router.push(`/course/${r.courseId}/diagnosis/${res.nextAttemptId}`);
      setMisses((m) => [...m, { answer, followUp: res.followUp ?? "Give one more precise answer." }]);
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
            sources={r.transfer.sources} question={r.transfer.question}
            hint={r.transfer.hint}
            showHint={hint}
            hintsEnabled={settings.showHints}
            onToggleHint={() => setHint((h) => !h)}
            description="Your first explanation looks sound. A different setup checks whether the idea transfers instead of only recognizing familiar wording."
          />
        </AssistantMessage>
        {misses.map((m, i) => (
          <div key={i} className="contents">
            <UserBubble>{m.answer}</UserBubble>
            <AssistantMessage>
              <AssistantCard ariaLabel="Need more evidence" label="Need more evidence" headline="Not enough to prove transfer yet.">
                <div className="px-[18px] py-3 text-[0.8125rem] leading-normal text-ink-2">{m.followUp}</div>
              </AssistantCard>
            </AssistantMessage>
          </div>
        ))}
      </Log>
      <Composer value={answer} onChange={setAnswer} onSubmit={submit} status={status} error={error} placeholder="Your answer" loadingText="Checking if it transfers..." />
    </>
  );
}

