"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { CatalogItem } from "@proveit/server/courses";
import { buttonStyles } from "../Button";

/** One curated course. The plus button adds it to In progress in the sidebar. */
export function CatalogCard({ item }: { item: CatalogItem }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setState("busy");
    setError(null);
    try {
      await api.addCatalogCourse(item.id);
      router.refresh();
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that course. Retry.");
      setState("error");
    }
  }

  async function remove() {
    setState("busy");
    setError(null);
    try {
      await api.removeCatalogCourse(item.id);
      router.refresh();
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that course. Retry.");
      setState("error");
    }
  }

  const busy = state === "busy";
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-[0.9375rem] font-semibold">{item.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem]">
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-ink-3">{item.topic}</span>
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-ink-3">{item.level}</span>
          </div>
        </div>
        {item.added ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-mastered-bg px-2.5 py-1 text-[0.6875rem] font-semibold text-mastered-text"><Check size={12} strokeWidth={2.4} aria-hidden />Added</span>
        ) : (
          <button type="button" onClick={add} disabled={busy} aria-label={`Add ${item.name}`} title="Add to In progress" className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-button bg-surface text-ink hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Plus size={16} strokeWidth={2.2} aria-hidden />}
          </button>
        )}
      </div>
      <p className="m-0 flex-1 text-[0.8125rem] leading-normal text-ink-muted">{item.summary}</p>
      <div className="flex items-center justify-between gap-3 text-xs text-ink-faint">
        <span>{item.concepts} concepts · {item.units} units</span>
        {item.added && (
          <span className="flex items-center gap-2">
            <button type="button" onClick={remove} disabled={busy} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-ink-muted underline hover:text-ink disabled:opacity-60">Remove</button>
            <Link href={`/course/${item.id}`} className={cn(buttonStyles({ size: "sm" }))}>Open</Link>
          </span>
        )}
      </div>
      {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
    </li>
  );
}
