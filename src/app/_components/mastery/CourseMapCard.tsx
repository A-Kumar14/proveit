"use client";

import { useState } from "react";
import { cn } from "@proveit/lib/cn";
import type { CourseView } from "@proveit/server/store";
import { AssistantCard } from "../chat/AssistantCard";
import { ConceptDetailsPanel } from "./ConceptDetailsPanel";
import { ConceptGraph } from "./ConceptGraph";
import { UnitsView } from "./UnitsView";
import { LOOK } from "@proveit/lib/mastery";

const seg = (on: boolean) => cn("cursor-pointer rounded-[7px] border px-[11px] py-[5px] text-xs", on ? "border-line-button bg-surface font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-3");

export function CourseMapCard({ course, initialId }: { course: CourseView; initialId: string }) {
  const [view, setView] = useState<"graph" | "units">("graph");
  const [selectedId, setSelectedId] = useState(initialId);
  const sel = course.concepts.find((c) => c.id === selectedId) ?? course.concepts[0];
  if (!sel) return null;
  const headline = (
    <>{course.proven} of {course.total} proven{course.needsWork > 0 && <>, <span className="text-needswork-text">{course.needsWork} needs work</span></>}</>
  );
  return (
    <AssistantCard
      ariaLabel="Course map" label={`Course map · ${course.name}`} headline={headline}
      meta={
        <div role="group" aria-label="Map view" className="flex gap-1 rounded-sm border border-line bg-surface p-[3px]">
          <button type="button" className={seg(view === "graph")} aria-pressed={view === "graph"} onClick={() => setView("graph")}>Graph</button>
          <button type="button" className={seg(view === "units")} aria-pressed={view === "units"} onClick={() => setView("units")}>Units</button>
        </div>
      }
    >
      <div className="flex">
        <div className="w-[500px] shrink-0 border-r border-line px-2.5 py-2">
          {view === "graph"
            ? <ConceptGraph concepts={course.concepts} edges={course.edges} selectedId={selectedId} onSelect={setSelectedId} />
            : <UnitsView concepts={course.concepts} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
        <ConceptDetailsPanel c={sel} />
      </div>
      <div className="flex items-center justify-between border-t border-line px-[18px] py-2 text-[11px] text-ink-faint">
        <span className="flex gap-3">
          {(["mastered", "developing", "needs_work"] as const).map((s) => (
            <span key={s} className="flex items-center gap-[5px]"><span className={cn("size-[7px] rounded-full", LOOK[s].dot)} />{LOOK[s].label}</span>
          ))}
        </span>
        <span>Nodes only turn green after a new-question test.</span>
      </div>
    </AssistantCard>
  );
}
