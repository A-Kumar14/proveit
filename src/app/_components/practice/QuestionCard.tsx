import { Info } from "lucide-react";
import { AssistantCard } from "../chat/AssistantCard";

export function QuestionCard({ conceptName, prompt, why, source }: { conceptName: string; prompt: string; why: string; source: string }) {
  return (
    <AssistantCard ariaLabel="Question" label={`Question · ${conceptName}`} headline={<span className="text-base leading-normal">{prompt}</span>}>
      <p className="m-0 border-b border-line px-[18px] py-3 text-[13px] text-ink-muted">In your own words. Type it, talk it through, or add a photo of your work.</p>
      <div className="flex gap-4 px-[18px] py-3 text-xs">
        <div className="flex-1"><div className="eyebrow mb-1 flex items-center gap-1.5"><Info size={12} aria-hidden />Why this question</div><div className="leading-normal text-ink-3">{why}</div></div>
        <div className="w-px bg-line" aria-hidden />
        <div className="flex-1"><div className="eyebrow mb-1">Graded against</div><div className="leading-normal text-ink-3">Your course material, {source}. Uploads only count if they show your own work.</div></div>
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
