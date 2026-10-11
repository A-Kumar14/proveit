import Link from "next/link";
import { buttonStyles } from "./_components/Button";

/** Any address that doesn't lead anywhere, or a concept that has no content yet. */
export default function NotFound() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="eyebrow">Not found</div>
      <h1 className="m-0 text-[1.375rem] font-semibold">We can&apos;t find that page</h1>
      <p className="m-0 max-w-sm text-[0.8125rem] text-ink-muted">The link may be old, or what it pointed to was removed. Your progress is safe.</p>
      <Link href="/" className={buttonStyles()}>Back to the dashboard</Link>
    </main>
  );
}
