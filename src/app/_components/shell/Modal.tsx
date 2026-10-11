"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Dialog that closes by returning to `closeHref`. Escape and the scrim also close it. */
export function Modal({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push(closeHref); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, closeHref]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/25" onClick={(e) => { if (e.target === e.currentTarget) router.push(closeHref); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[calc(100vh-48px)] w-[680px] max-w-[calc(100vw-32px)] flex-col gap-4 overflow-y-auto glass rounded-lg border p-[22px]">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-semibold">{title}</h2>
          <button ref={closeBtn} type="button" aria-label="Close" onClick={() => router.push(closeHref)} className="flex size-[34px] cursor-pointer items-center justify-center rounded-sm border border-line bg-transparent text-ink-2"><X size={14} strokeWidth={2.2} aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
