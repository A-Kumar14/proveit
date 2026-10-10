"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import type { UploadCheck } from "@proveit/lib/schemas";
import { api } from "@proveit/lib/api";

export type Checked = { name: string; check: UploadCheck };

const DEMO: { label: string; name: string; check: UploadCheck }[] = [
  { label: "Demo: photo of my work", name: "work-page1.jpg", check: { is_student_work: true, relevant: true, summary: "Handwritten: a 95% probability that the true mean is inside this interval.", reason: "" } },
  { label: "Demo: a lecture slide", name: "slide-12.png", check: { is_student_work: false, relevant: true, summary: "", reason: "That upload is a slide. Add a photo of what you wrote." } },
];

/** Opens the file picker and posts the image to the upload check. The demo items only render in DEMO_MODE. */
export function AddFileMenu({ conceptId, demo, disabled, onChecked, onError }: {
  conceptId: string; demo: boolean; disabled?: boolean; onChecked: (c: Checked) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChecked({ name: file.name, check: await api.checkUpload(file, conceptId) });
    } catch (e) {
      onError(e instanceof Error ? e.message : "The upload check failed. Retry.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose an image" onChange={(e) => pick(e.target.files?.[0])} />
      <button
        type="button" aria-haspopup="menu" aria-expanded={open} disabled={disabled || busy}
        onClick={() => (demo ? setOpen((o) => !o) : input.current?.click())}
        className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 py-[7px] text-xs font-semibold text-ink-2 hover:bg-surface-hover disabled:opacity-50"
      >
        <Paperclip size={14} strokeWidth={2} aria-hidden />{busy ? "Checking..." : "Add file"}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-10 mb-1.5 w-60 rounded-md border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
          <button role="menuitem" type="button" className="w-full cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-2 text-left text-[13px] hover:bg-surface-hover" onClick={() => { setOpen(false); input.current?.click(); }}>Choose a file</button>
          {DEMO.map((d) => (
            <button key={d.name} role="menuitem" type="button" className="w-full cursor-pointer rounded-sm border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-developing-text hover:bg-surface-hover" onClick={() => { setOpen(false); onChecked({ name: d.name, check: d.check }); }}>{d.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
