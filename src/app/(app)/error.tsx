"use client";

import Link from "next/link";
import { buttonStyles } from "@proveit/app/_components/Button";

/** Keep server/model failures recoverable without exposing server error details. */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8" role="alert">
      <h1 className="m-0 text-xl font-semibold">This study page could not load.</h1>
      <p className="m-0 text-sm text-ink-muted">Your saved learning evidence is still available. Try again in a moment. Building questions from course materials requires an available AI connection.</p>
      <div className="flex gap-2">
        <button type="button" className={buttonStyles()} onClick={retry}>Try again</button>
        <Link href="/courses" className={buttonStyles({ variant: "secondary" })}>Back to courses</Link>
      </div>
    </main>
  );
}
