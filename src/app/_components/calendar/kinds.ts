import type { CalKind } from "@proveit/server/calendar";

/** Every kind has a label and a marker shape as well as a color. */
export const KIND: Record<CalKind | "study", { label: string; dot: string; chip: string }> = {
  class: { label: "Class", dot: "bg-ink", chip: "border-l-ink bg-surface-active" },
  quiz: { label: "Quiz", dot: "bg-needswork", chip: "border-l-needswork bg-needswork-bg" },
  review: { label: "Review", dot: "bg-developing", chip: "border-l-developing bg-developing-bg" },
  other: { label: "Other", dot: "bg-ink-faint", chip: "border-l-ink-faint bg-surface-subtle" },
  study: { label: "Suggested study", dot: "border border-dashed border-mastered bg-mastered-bg", chip: "border-l-mastered bg-mastered-bg border-dashed" },
};
