"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pen, Undo2 } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { Button } from "../Button";

type Stroke = { erase: boolean; points: [number, number][] };
const W = 560, H = 280;

/** Freehand pad. "Show the tutor" sends the drawing through the same upload check as a photo. */
export function SketchPad({ onShow, busy }: { onShow: (file: File) => void; busy: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const live = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = ctx.lineJoin = "round";
    for (const s of [...strokes.current, ...(live.current ? [live.current] : [])]) {
      ctx.strokeStyle = s.erase ? "#fff" : "#1F1F1F";
      ctx.lineWidth = s.erase ? 18 : 3;
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (s.points.length === 1) ctx.lineTo(s.points[0]![0] + 0.1, s.points[0]![1]);
      ctx.stroke();
    }
  }, []);
  useEffect(redraw, [redraw]);

  const at = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };

  function show() {
    canvas.current?.toBlob((b) => b && onShow(new File([b], "sketch.png", { type: "image/png" })), "image/png");
  }

  const toolBtn = (id: "pen" | "eraser", label: string, Icon: typeof Pen) => (
    <button type="button" aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)}
      className={cn("flex h-[34px] w-[38px] cursor-pointer items-center justify-center rounded-[7px] border", tool === id ? "border-line-button bg-surface text-ink" : "border-transparent bg-transparent text-ink-3")}>
      <Icon size={16} strokeWidth={1.8} aria-hidden />
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <canvas
        ref={canvas} width={W} height={H} aria-label="Sketch area" className="h-[280px] w-full touch-none rounded-sm border border-line bg-white"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); live.current = { erase: tool === "eraser", points: [at(e)] }; redraw(); }}
        onPointerMove={(e) => { if (live.current) { live.current.points.push(at(e)); redraw(); } }}
        onPointerUp={() => { if (live.current) { strokes.current.push(live.current); live.current = null; setCount(strokes.current.length); redraw(); } }}
      />
      <div className="flex items-center justify-between gap-3">
        <div role="toolbar" aria-label="Sketch tools" className="flex gap-1 rounded-sm border border-line bg-surface-subtle p-[3px]">
          {toolBtn("pen", "Pen", Pen)}
          {toolBtn("eraser", "Eraser", Eraser)}
          <button type="button" aria-label="Undo" disabled={count === 0} onClick={() => { strokes.current.pop(); setCount(strokes.current.length); redraw(); }}
            className="flex h-[34px] w-[38px] cursor-pointer items-center justify-center rounded-[7px] border border-transparent bg-transparent text-ink-3 disabled:opacity-40"><Undo2 size={16} strokeWidth={1.8} aria-hidden /></button>
        </div>
        <Button size="sm" onClick={show} disabled={busy || count === 0}>{busy ? "Checking..." : "Show the tutor"}</Button>
      </div>
    </div>
  );
}
