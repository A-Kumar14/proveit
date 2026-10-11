import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { buttonStyles } from "../Button";

/** Centered page for the sign-in and sign-up screens. `children` is the Clerk form, or a note when accounts are off. */
export function AuthShell({ enabled, mode, children }: { enabled: boolean; mode: "in" | "up"; children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-6 overflow-y-auto bg-surface-sidebar px-4 py-10">
      <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
        <span className="flex size-8 items-center justify-center rounded-md bg-ink"><BarChart3 size={18} strokeWidth={2.2} className="text-white" aria-hidden /></span>
        <span className="text-lg font-semibold tracking-tight">Mastery</span>
      </Link>
      {enabled ? children : (
        <section className="flex max-w-sm flex-col gap-3 rounded-md border border-line bg-surface p-6">
          <h1 className="m-0 text-lg font-semibold">Accounts are turned off</h1>
          <p className="m-0 text-[0.8125rem] leading-normal text-ink-muted">Sign-{mode} needs Clerk keys. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to the server environment and restart. Until then the app runs without an account.</p>
          <Link href="/" className={buttonStyles({ size: "md" })}>Continue to the app</Link>
        </section>
      )}
    </main>
  );
}
