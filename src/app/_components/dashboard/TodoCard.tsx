"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { ScheduledGroup, ScheduledTask } from "@proveit/server/schedule";
import { buttonStyles } from "../Button";
import { Widget } from "./Widget";
import { useConfetti } from "./useConfetti";

const SEEN = "proveit.todo.seenDone";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * Read-only to-do list. Tasks finish by themselves when your answers prove the concept, or you can tick one by hand.
 * Ticking never changes mastery: only evidence does.
 */
export function TodoCard({ groups, userId = "local" }: { groups: ScheduledGroup[]; userId?: string }) {
  const storageKey = userId === "local" ? SEEN : `${SEEN}:${JSON.stringify(userId)}`;
  const router = useRouter();
  const confetti = useConfetti();
  const card = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Tasks your answers finished since you last looked get a celebration, once. The first visit only records them.
  const finishedByWork = groups.flatMap((g) => g.done).filter((t) => t.doneBy === "progress").map((t) => t.id).join(",");
  useEffect(() => {
    const ids = finishedByWork ? finishedByWork.split(",") : [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null && ids.some((id) => !(JSON.parse(raw) as string[]).includes(id)) && card.current) confetti({ x: card.current.getBoundingClientRect().right - 40, y: card.current.getBoundingClientRect().top + 30 });
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch { /* storage unavailable: no celebration */ }
  }, [finishedByWork, confetti, storageKey]);

  async function tick(t: ScheduledTask | ScheduledGroup["done"][number], done: boolean, el: Element) {
    setBusy(true);
    setError(null);
    try {
      await api.setTaskDone(t.id, done);
      if (done) confetti(el);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Retry.");
    }
    setBusy(false);
  }

  async function finishCourse(g: ScheduledGroup, el: Element) {
    setBusy(true);
    setError(null);
    try {
      await api.setCoursesCompleted([g.courseId], true);
      confetti(el);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Retry.");
    }
    setBusy(false);
  }

  const openCount = groups.reduce((n, g) => n + g.open.length, 0);

  return (
    <Widget title="To-do" action={{ label: "All courses", href: "/courses" }} className="min-w-0">
      <div ref={card} className="flex flex-col gap-4">
        <p className="m-0 text-xs text-ink-muted">{openCount === 0 ? "Nothing left to do." : `${openCount} to go across ${groups.filter((g) => g.open.length).length} ${groups.filter((g) => g.open.length).length === 1 ? "course" : "courses"}.`} Tasks finish when your answers prove them. Ticking one by hand doesn&apos;t change your mastery.</p>
        {error && <div role="alert" className="rounded-sm border border-needswork-line bg-needswork-bg px-3 py-2 text-xs text-needswork-text">{error}</div>}
        {groups.length === 0 && <p className="m-0 text-[13px] text-ink-muted">Every course is completed. Add a course to get new tasks.</p>}
        {groups.map((g) => (
          <section key={g.courseId} aria-label={g.courseName} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
              <div className="flex items-baseline gap-2"><h3 className="m-0 text-[13px] font-semibold">{g.courseName}</h3><span className="text-[11px] text-ink-faint">{g.doneCount} of {g.total} done</span></div>
              <button type="button" disabled={busy} onClick={(e) => finishCourse(g, e.currentTarget)} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-ink-muted underline hover:text-ink disabled:opacity-50">Mark course done</button>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {g.open.map((t) => (
                <li key={t.id} className="flex items-center gap-2.5 py-1.5">
                  <Box checked={false} disabled={busy} label={`Mark ${t.title} done`} onClick={(el) => tick(t, true, el)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-[13px] font-medium">{t.title}</span>
                      {t.next && <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-semibold text-white">Next</span>}
                      <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", LOOK[t.state].pill)}>{t.why}</span>
                    </div>
                    {t.slot && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted"><Clock size={11} aria-hidden />Suggested <time dateTime={t.slot.start} suppressHydrationWarning>{when(t.slot.start)}</time></div>}
                  </div>
                  {t.href ? <Link href={t.href} className={buttonStyles({ variant: "secondary", size: "sm" })}>Start</Link> : <span className="text-[11px] text-ink-faint">Not in demo</span>}
                </li>
              ))}
              {g.open.length === 0 && <li className="py-1.5 text-xs text-ink-muted">All tasks done. Mark the course done to move it to Completed.</li>}
            </ul>
            {g.done.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none text-[11px] text-ink-faint [&::-webkit-details-marker]:hidden">Done ({g.done.length})</summary>
                <ul className="m-0 mt-1 flex list-none flex-col p-0">
                  {g.done.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 py-1">
                      <Box checked disabled={busy || t.doneBy === "progress"} label={t.doneBy === "progress" ? `${t.title}, finished by your answers` : `Mark ${t.title} not done`} onClick={(el) => tick(t, false, el)} />
                      <span className="flex-1 truncate text-[13px] text-ink-muted line-through">{t.title}</span>
                      <span className="text-[11px] text-ink-faint">{t.doneBy === "progress" ? "By your answers" : "By you"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ))}
      </div>
    </Widget>
  );
}

function Box({ checked, disabled, label, onClick }: { checked: boolean; disabled: boolean; label: string; onClick: (el: Element) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={(e) => onClick(e.currentTarget)}
      className={cn("flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border p-0 disabled:cursor-default", checked ? "border-ink bg-ink text-white" : "border-line-button bg-surface hover:border-ink")}>
      {checked && <Check size={12} strokeWidth={3} aria-hidden />}
    </button>
  );
}
