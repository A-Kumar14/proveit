"use client";

import { useCallback } from "react";

const COLORS = ["#1F1F1F", "#2E9E5B", "#C98A0C", "#8A8A8A"];

/**
 * A small burst of confetti at a point. Skipped under prefers-reduced-motion.
 * Particles are plain elements animated with the Web Animations API and removed when done, so nothing stays in the DOM.
 */
export function useConfetti() {
  return useCallback((origin: Element | { x: number; y: number }) => {
    if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = origin instanceof Element ? origin.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : (origin as { x: number }).x;
    const y = r ? r.top + r.height / 2 : (origin as { y: number }).y;
    for (let i = 0; i < 22; i++) {
      const p = document.createElement("span");
      const size = 5 + Math.random() * 4;
      Object.assign(p.style, { position: "fixed", left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`, background: COLORS[i % COLORS.length], borderRadius: "1px", pointerEvents: "none", zIndex: "60" });
      p.setAttribute("aria-hidden", "true");
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 70;
      p.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 30}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${Math.cos(angle) * dist * 1.1}px, ${Math.sin(angle) * dist + 40}px) rotate(${Math.random() * 540}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 300, easing: "cubic-bezier(.2,.7,.3,1)" },
      ).onfinish = () => p.remove();
    }
  }, []);
}
