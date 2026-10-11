"use client";

import type { ConceptView } from "@proveit/server/store";
import { ConceptNode } from "./ConceptNode";

const unitLabel = (u: string) => {
  const name = u.replace(/^\d+\s*/, "").toLowerCase();
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Edge look from the two end states: green when both mastered, red dashed into a needs-work node, faint dashed when untouched. */
function edgeLook(a: ConceptView, b: ConceptView) {
  if (a.state === "mastered" && b.state === "mastered") return { stroke: "var(--color-mastered)", w: 2, dash: undefined };
  if (b.state === "needs_work" || a.state === "needs_work") return { stroke: "var(--color-needswork)", w: 2, dash: "6 4" };
  if (a.state === "not_started" || b.state === "not_started") return { stroke: "var(--color-line-button)", w: 1.4, dash: "3 4" };
  return { stroke: "var(--color-line-button)", w: 1.5, dash: undefined };
}

function edgePath(a: ConceptView, b: ConceptView) {
  if (a.x === b.x) {
    const down = b.y > a.y;
    return `M${a.x} ${a.y + (down ? 20 : -20)} L${b.x} ${b.y + (down ? -20 : 20)}`;
  }
  const x1 = a.x + 20, x2 = b.x - 20, mid = (x1 + x2) / 2;
  return a.y === b.y ? `M${x1} ${a.y} L${x2} ${b.y}` : `M${x1} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${x2} ${b.y}`;
}

export function ConceptGraph({ concepts, edges, selectedId, onSelect }: {
  concepts: ConceptView[]; edges: [string, string][]; selectedId: string; onSelect: (id: string) => void;
}) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const units = [...new Set(concepts.map((c) => c.unit))];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid text-center text-[0.6875rem] text-ink-faint" style={{ gridTemplateColumns: `repeat(${units.length}, minmax(0, 1fr))` }}>
        {units.map((u) => <span key={u}>{unitLabel(u)}</span>)}
      </div>
      <div className="relative aspect-[480/336] w-full">
      <svg viewBox="0 0 480 336" aria-hidden className="absolute inset-0 size-full">
        {edges.map(([from, to]) => {
          const a = byId.get(from), b = byId.get(to);
          if (!a || !b) return null;
          const l = edgeLook(a, b);
          return <path key={`${from}-${to}`} d={edgePath(a, b)} fill="none" stroke={l.stroke} strokeWidth={l.w} strokeDasharray={l.dash} />;
        })}
      </svg>
      {concepts.map((c) => (
        <ConceptNode key={c.id} id={c.id} name={c.name} short={c.short} x={c.x} y={c.y} state={c.state} selected={c.id === selectedId} onSelect={onSelect} />
      ))}
      </div>
    </div>
  );
}
