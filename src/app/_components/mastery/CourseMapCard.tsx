"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { MasteryState } from "@proveit/lib/schemas";
import type { CourseView } from "@proveit/server/store";
import { buttonStyles } from "../Button";
import { Widget } from "../dashboard/Widget";

const unitLabel = (u: string) => {
  const name = u.replace(/^\d+\s*/, "").toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const statusDot = (state: MasteryState) =>
  state === "provisional" ? "border border-dashed border-mastered bg-mastered-bg" : LOOK[state].dot;

const done = (state: MasteryState) => state === "mastered";

/** The course map as a trunk of units, with each concept on a branch. */
export function CourseMapCard({ course, initialId }: { course: CourseView; initialId: string }) {
  const [selectedId, setSelectedId] = useState(initialId);
  const [show, setShow] = useState<"remaining" | "completed">("remaining");
  const visible = course.concepts.filter((c) => (show === "completed" ? done(c.state) : !done(c.state)));
  const sel = visible.find((c) => c.id === selectedId) ?? visible[0] ?? null;
  const units = [...new Set(visible.map((c) => c.unit))];
  return (
    <Widget
      title="Course map"
      heading
      className="min-w-0"
      aside={
        <div role="group" aria-label="Which concepts to show" className="flex gap-1 rounded-sm border border-line p-[2px]">
          {(["remaining", "completed"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={show === key}
              onClick={() => setShow(key)}
              className={cn("cursor-pointer rounded-[5px] border px-2 py-1 text-xs", show === key ? "border-line-button bg-surface font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-muted")}
            >
              {key === "remaining" ? "Remaining" : "Completed"}
            </button>
          ))}
        </div>
      }
    >
      <p className="m-0 text-xs text-ink-muted">
        {show === "remaining" ? `${visible.length} left` : `${visible.length} completed`}
      </p>
      {visible.length === 0 && (
        <p className="m-0 text-[13px] text-ink-muted">{show === "remaining" ? "Nothing left in this course." : "Nothing completed yet."}</p>
      )}
      <div className="flex flex-col">
        {units.map((unit, i) => {
          const list = visible.filter((c) => c.unit === unit);
          const open = sel ? list.some((c) => c.id === sel.id) : false;
          return (
            <section key={unit} aria-label={unitLabel(unit)} className={cn("relative pl-5", i < units.length - 1 && "pb-4")}>
              {i < units.length - 1 && <span className="absolute top-2 bottom-0 left-[3px] w-px bg-line" aria-hidden />}
              <span className={cn("absolute top-1.5 left-0 size-2 rounded-full", open ? "bg-ink" : "bg-ink-faint")} aria-hidden />
              <div className="min-w-0">
                <h3 className="m-0 flex items-baseline justify-between gap-2 text-[13px] font-semibold">
                  {unitLabel(unit)}
                  <span className="text-[11px] font-normal text-ink-faint">{list.length}</span>
                </h3>
                <ul className="relative m-0 mt-1 ml-[3px] flex list-none flex-col border-l border-line p-0">
                  {list.map((c) => (
                    <li key={c.id} className="relative pl-4">
                      <span className={cn("absolute top-1/2 left-0 h-px w-4", c.id === sel?.id ? "bg-ink" : "bg-line")} aria-hidden />
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        aria-pressed={c.id === sel?.id}
                        aria-label={`${c.name}, ${LOOK[c.state].label}`}
                        className={cn("flex w-full cursor-pointer items-center gap-2 rounded-sm border px-2 py-1.5 text-left", c.id === sel?.id ? "border-ink bg-surface-hover" : "border-transparent hover:bg-surface-hover")}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", statusDot(c.state))} aria-hidden />
                        <span className="min-w-0 flex-1 text-[13px]">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      {sel && <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{sel.name}</span>
            <span className={cn("rounded-full px-1.5 py-px text-[10px] font-semibold", LOOK[sel.state].pill)}>{LOOK[sel.state].label}</span>
          </div>
          <p className="m-0 mt-0.5 text-xs text-ink-muted">{sel.desc}</p>
        </div>
        {sel.cta.href
          ? <Link href={sel.cta.href} className={buttonStyles({ size: "sm" })}>{sel.cta.label}</Link>
          : <span className="text-[11px] text-ink-faint">{sel.cta.label}</span>}
      </div>}
      <div className="flex flex-wrap gap-3 text-[11px] text-ink-faint">
        {(["mastered", "provisional", "developing", "needs_work", "not_started"] as const).map((s) => (
          <span key={s} className="flex items-center gap-[5px]"><span className={cn("size-[7px] rounded-full", statusDot(s))} />{LOOK[s].label}</span>
        ))}
      </div>
    </Widget>
  );
}
