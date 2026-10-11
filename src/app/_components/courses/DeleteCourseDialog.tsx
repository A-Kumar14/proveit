"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";

/** Asks before deleting a course. What goes and what stays is spelled out, since this can't be undone. */
export function DeleteCourseDialog({ course, onClose, onDeleted }: { course: { id: string; name: string }; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.removeCourse(course.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that course. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4" onClick={() => { if (!busy) onClose(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-body" onClick={(e) => e.stopPropagation()}
        className="glass flex w-full max-w-md flex-col gap-3 rounded-md border p-5">
        <h2 id="delete-title" className="m-0 text-base font-semibold">Delete {course.name}?</h2>
        <p id="delete-body" className="m-0 text-[0.8125rem] leading-normal text-ink-muted">
          This removes the course map, your uploaded files, its quizzes and your answers for it. It can&apos;t be undone. Rank points you already earned stay.
        </p>
        {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
        <div className="flex justify-end gap-2">
          <button ref={cancel} type="button" onClick={onClose} disabled={busy} className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer")}>Cancel</button>
          <button type="button" onClick={() => void remove()} disabled={busy} className={cn(buttonStyles(), "cursor-pointer")}>
            {busy && <LoaderCircle size={14} className="animate-spin" aria-hidden />}{busy ? "Deleting..." : "Delete course"}
          </button>
        </div>
      </div>
    </div>
  );
}
