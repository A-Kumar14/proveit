import { Info } from "lucide-react";
import { AssistantCard } from "../chat/AssistantCard";

export function QuestionCard({ conceptName, prompt, why }: { conceptName: string; prompt: string; why: string }) {
  return (
    <AssistantCard ariaLabel="Question" label={`Question · ${conceptName}`} headline={<span className="text-base leading-normal">{prompt}</span>}>
      <div className="flex items-start gap-2 px-[18px] py-3 text-xs text-ink-muted">
        <Info size={14} strokeWidth={1.8} className="mt-px shrink-0" aria-hidden />
        <span><span className="font-semibold text-ink-3">Why this question.</span> {why}</span>
      </div>
    </AssistantCard>
  );
}

/** Shown when the evaluator can't classify an answer yet. Never guesses a diagnosis. */
export function ClarificationCard({ text }: { text: string }) {
  return (
    <AssistantCard ariaLabel="Clarification" label="One more answer" headline="I need one more answer before I'm sure.">
      <div className="px-[18px] py-3 text-[13px] leading-normal text-ink-2">{text}</div>
    </AssistantCard>
  );
}
