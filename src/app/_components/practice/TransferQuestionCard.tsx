import { AssistantCard } from "../chat/AssistantCard";

export function TransferQuestionCard({
  question, hint, showHint, hintsEnabled, onToggleHint,
  description = "The setup is different. The idea underneath is the one you just fixed. Repeating the first question would only check memory.",
}: {
  question: string; hint: string; showHint: boolean; hintsEnabled: boolean; onToggleHint: () => void; description?: string;
}) {
  return (
    <AssistantCard ariaLabel="Transfer question" label="New question · same idea" headline="Now prove it transfers.">
      <div className="flex flex-col gap-2 px-[18px] py-3">
        <p className="m-0 text-xs text-ink-muted">{description}</p>
        <p className="m-0 text-base font-semibold leading-normal">{question}</p>
      </div>
      {hintsEnabled && (
        <div className="flex items-center justify-end px-[18px] pb-2.5">
          <button type="button" onClick={onToggleHint} aria-expanded={showHint} className="cursor-pointer border-0 bg-transparent text-xs text-developing-text">{showHint ? "Hide hint" : "Need a hint?"}</button>
        </div>
      )}
      {hintsEnabled && showHint && <div className="mx-[18px] mb-3 rounded-sm border border-developing-line bg-developing-bg px-3 py-2 text-xs text-developing-text">{hint}</div>}
    </AssistantCard>
  );
}
