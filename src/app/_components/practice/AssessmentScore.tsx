import type { AssessmentReward } from "@proveit/lib/schemas";

export function AssessmentScore({ reward }: { reward?: AssessmentReward }) {
  if (!reward) return null;
  return <p className="px-4 text-sm" aria-label="Assessment score">
    {reward.score === null ? "Percentage scoring requires the AI rubric; no assessment points awarded." : `${reward.score}% · ${reward.level} · +${reward.pointsGained} points`}
    {reward.score !== null && <span className="block text-xs text-ink-muted">70%: proficiency. 90%: assessment mastery. Transfer and delayed review establish durable mastery.</span>}
  </p>;
}
