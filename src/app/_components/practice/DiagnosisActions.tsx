"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, buttonStyles } from "../Button";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";

export function DiagnosisActions({ attemptId, lessonHref }: { attemptId: string; lessonHref: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispute() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.clarify(attemptId);
      router.push(`/course/${r.courseId}/practice/${r.conceptId}?clarify=${attemptId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Link href={lessonHref} className={cn(buttonStyles(), "px-4")}>Fix this gap<ArrowRight size={14} strokeWidth={2.2} aria-hidden /></Link>
        <Button variant="secondary" onClick={dispute} disabled={busy}>{busy ? "Opening..." : "That's not what I meant"}</Button>
      </div>
      {error && <div role="alert" className="text-xs text-needswork-text">{error} <button type="button" onClick={dispute} className="cursor-pointer border-0 bg-transparent p-0 text-xs underline">Retry</button></div>}
    </div>
  );
}
