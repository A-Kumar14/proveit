"use client";

import { useEffect, useRef } from "react";
import { READING_EVENT } from "./readAloud";

/**
 * A reading band: everything above and below the current line is dimmed. It follows the pointer,
 * the focused control for keyboard users, and the spoken word while read aloud is running.
 * It writes a CSS variable instead of state, so moving the pointer never re-renders React.
 */
export function LineFocus() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = (y: number | null) => {
      const node = el.current;
      if (!node) return;
      node.hidden = y === null;
      if (y !== null) node.style.setProperty("--focus-y", `${Math.round(y)}px`);
    };
    const move = (e: PointerEvent) => at(e.clientY);
    const focus = (e: FocusEvent) => {
      if (!(e.target instanceof Element) || e.target === document.body) return;
      const r = e.target.getBoundingClientRect();
      at(r.top + r.height / 2);
    };
    const reading = (e: Event) => at((e as CustomEvent<{ y: number }>).detail.y);
    const leave = () => at(null);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("focusin", focus);
    window.addEventListener(READING_EVENT, reading);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("focusin", focus);
      window.removeEventListener(READING_EVENT, reading);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={el} hidden aria-hidden className="line-focus">
      <div />
      <div />
    </div>
  );
}
