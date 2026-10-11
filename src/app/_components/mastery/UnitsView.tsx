"use client";

import { cn } from "@proveit/lib/cn";
import { LOOK } from "@proveit/lib/mastery";
import type { ConceptView } from "@proveit/server/store";

export function UnitsView({ concepts, selectedId, onSelect, source }: { concepts: ConceptView[]; selectedId: string; onSelect: (id: string) => void; source?: string }) {
  const units = [...new Set(concepts.map((c) => c.unit))];
  return (
    <div className="grid h-[336px] grid-cols-2 content-start gap-2 py-1">
      {units.map((u) => {
        const list = concepts.filter((c) => c.unit === u);
        return (
          <div key={u} className="flex flex-col gap-0.5 rounded-sm border border-line bg-surface-subtle p-2">
            <div className="flex items-center justify-between px-1 pb-1 text-[0.625rem] tracking-[0.06em]">
              <span>{u.replace("CONFIDENCE INTERVALS", "CONF. INTERVALS")}</span>
              <span className="text-ink-faint">{list.filter((c) => c.state === "mastered").length}/{list.length}</span>
            </div>
            {list.map((c) => (
              <button
                key={c.id} type="button" onClick={() => onSelect(c.id)} aria-pressed={c.id === selectedId}
                className={cn("flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-[7px] border p-1.5 text-left text-xs text-ink-2",
                  c.id === selectedId ? "border-ink bg-surface-hover" : "border-transparent bg-transparent")}
              >
                <span>{c.name}</span>
                <span className={cn("whitespace-nowrap rounded-full px-[7px] py-0.5 text-[0.625rem] font-semibold", LOOK[c.state].chip)}>{LOOK[c.state].label}</span>
              </button>
            ))}
          </div>
        );
      })}
      {source && <div className="col-span-2 p-1 text-[0.6875rem] text-ink-faint">{source}</div>}
    </div>
  );
}
