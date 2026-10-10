import type { MasteryState } from "./schemas";

/** One look per state. Every state also carries an icon and a label in the UI, never color alone. */
export const LOOK: Record<
  MasteryState,
  { label: string; dot: string; bar: string; text: string; pill: string; chip: string; node: string }
> = {
  mastered: {
    label: "Mastered",
    dot: "bg-mastered",
    bar: "bg-mastered",
    text: "text-mastered-text",
    pill: "bg-mastered-bg text-mastered-text",
    chip: "bg-mastered-line text-mastered-text",
    node: "border-solid border-mastered bg-mastered-line",
  },
  provisional: {
    label: "Provisional",
    dot: "bg-mastered",
    bar: "bg-mastered",
    text: "text-mastered-text",
    pill: "bg-mastered-bg text-mastered-text border border-dashed border-mastered",
    chip: "bg-mastered-bg text-mastered-text border border-dashed border-mastered",
    node: "border-dashed border-mastered bg-mastered-bg",
  },
  developing: {
    label: "Developing",
    dot: "bg-developing",
    bar: "bg-developing",
    text: "text-developing-text",
    pill: "bg-developing-bg text-developing-text",
    chip: "bg-developing-line text-developing-text",
    node: "border-solid border-developing bg-developing-line",
  },
  needs_work: {
    label: "Needs work",
    dot: "bg-needswork",
    bar: "bg-needswork",
    text: "text-needswork-text",
    pill: "bg-needswork-bg text-needswork-text",
    chip: "bg-needswork-line text-needswork-text",
    node: "border-solid border-needswork bg-needswork-line",
  },
  not_started: {
    label: "Not started",
    dot: "bg-surface-strong",
    bar: "bg-ink-muted",
    text: "text-ink-3",
    pill: "bg-line text-ink-3",
    chip: "bg-line text-ink-3",
    node: "border-dashed border-line bg-line",
  },
};

export type Tone = "good" | "warn" | "bad" | "none";

export const TONE = {
  good: { bar: "bg-mastered", text: "text-mastered-text", pill: "bg-mastered-bg text-mastered-text" },
  warn: { bar: "bg-developing", text: "text-developing-text", pill: "bg-developing-bg text-developing-text" },
  bad: { bar: "bg-needswork", text: "text-needswork-text", pill: "bg-needswork-bg text-needswork-text" },
  none: { bar: "bg-ink-muted", text: "text-ink-muted", pill: "bg-line text-ink-3" },
} satisfies Record<Tone, { bar: string; text: string; pill: string }>;

export const toneForPct = (pct: number): Tone => (pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad");
