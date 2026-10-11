import { AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@proveit/lib/cn";

type Edge = "default" | "bad" | "good";
const EDGE: Record<Edge, string> = { default: "border-line", bad: "border-needswork-line", good: "border-mastered-line" };
const LABEL: Record<Edge, string> = { default: "text-ink-muted", bad: "text-needswork-text", good: "text-mastered-text" };

/** The card pattern: header, then any of table / callouts / actions / footer, in that order. */
export function AssistantCard({ ariaLabel, label, headline, meta, edge = "default", children }: {
  ariaLabel: string; label: string; headline: React.ReactNode; meta?: React.ReactNode; edge?: Edge; children?: React.ReactNode;
}) {
  return (
    <article aria-label={ariaLabel} className={cn("overflow-hidden rounded-md border bg-surface", EDGE[edge])}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-[18px] py-3.5">
        <div>
          <div className={cn("eyebrow", LABEL[edge])}>{label}</div>
          <h2 className="m-0 mt-1 text-[1.125rem] font-semibold">{headline}</h2>
        </div>
        {meta && <div className="mt-0.5 whitespace-nowrap text-xs text-ink-3">{meta}</div>}
      </div>
      {children}
    </article>
  );
}

export function CardTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="px-[18px] pt-1">
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead>
          <tr className="text-left text-[0.6875rem] tracking-[0.06em] text-ink-faint">
            {head.map((h) => <th key={h} scope="col" className="px-2 pb-2 pt-2.5 font-medium first:pl-0 last:pr-0">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Row = ({ children }: { children: React.ReactNode }) => <tr className="border-t border-line">{children}</tr>;
export const Cell = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={cn("px-2 py-[9px] first:pl-0 last:pr-0", className)}>{children}</td>;

export const CalloutRow = ({ children }: { children: React.ReactNode }) => <div className="flex gap-3 px-[18px] py-3">{children}</div>;

export function Callout({ kind, title, grow = 1, children }: { kind: "risk" | "advice" | "plain"; title: string; grow?: number; children: React.ReactNode }) {
  const Icon = kind === "risk" ? AlertTriangle : Lightbulb;
  return (
    <div
      style={{ flexGrow: grow }}
      className={cn("flex min-w-0 flex-1 flex-col gap-1.5 rounded-sm border px-3.5 py-3",
        kind === "risk" ? "border-needswork-line bg-needswork-bg" : kind === "advice" ? "border-line-soft bg-surface-hover" : "border-line bg-surface-subtle")}
    >
      <div className={cn("flex items-center gap-1.5 text-[0.6875rem] tracking-[0.06em] uppercase", kind === "risk" ? "text-needswork-text" : "text-ink-muted")}>
        {kind !== "plain" && <Icon size={13} strokeWidth={2.2} aria-hidden />}
        {title}
      </div>
      <div className="text-[0.8125rem] leading-normal text-ink-2">{children}</div>
    </div>
  );
}

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5 px-[18px] pb-3.5">
    <div className="text-[0.6875rem] tracking-[0.06em] text-ink-faint uppercase">{title}</div>
    {children}
  </div>
);

export function CardFooter({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-[18px] pb-3.5 text-[0.6875rem] text-ink-faint">
      <span>{left}</span>
      {right && <span className="text-developing-text">{right}</span>}
    </div>
  );
}
