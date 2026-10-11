import Link from "next/link";
import { buttonStyles } from "../Button";

/** Every empty list says what's missing and offers one next action. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-line bg-surface-subtle px-5 py-5">
      <div className="text-sm font-semibold">{title}</div>
      <p className="m-0 max-w-md text-[0.8125rem] text-ink-muted">{body}</p>
      {action && <Link href={action.href} className={buttonStyles({ size: "sm" })}>{action.label}</Link>}
    </div>
  );
}
