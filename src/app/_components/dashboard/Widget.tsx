import Link from "next/link";
import { cn } from "@proveit/lib/cn";

/** Shell shared by every dashboard widget: small label, optional link, then the body. */
export function Widget({ title, action, className, children }: { title: string; action?: { label: string; href: string }; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-md border border-line bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow m-0 font-normal">{title}</h2>
        {action && <Link href={action.href} className="text-xs text-ink-muted no-underline hover:text-ink">{action.label}</Link>}
      </div>
      {children}
    </section>
  );
}
