"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import type { FileUploadResult } from "@proveit/lib/schemas";
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from "@proveit/lib/uploadTypes";

export type FileRow = { id: string; name: string; detail: string; kind: string; removable: boolean };


/** The files a course is built from, plus a drop zone to add more. Added files feed the tutor, notes, paper and quiz. */
export function CourseFiles({ courseId, files }: { courseId: string; files: FileRow[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState<FileUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(list: FileList | File[]) {
    const picked = Array.from(list);
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.uploadFiles(courseId, picked));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Retry.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.removeFile(courseId, id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove that file. Retry.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void send(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center gap-2 rounded-md border-[1.5px] border-dashed px-4 py-6 text-center transition-colors", over ? "border-ink bg-surface-hover" : "border-line bg-surface-subtle")}
      >
        <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose files to add" onChange={(e) => e.target.files && void send(e.target.files)} />
        {busy ? <LoaderCircle size={22} className="animate-spin" aria-hidden /> : <Upload size={22} strokeWidth={1.8} aria-hidden />}
        <div className="text-[13px] font-semibold">{busy ? "Reading your files..." : "Add notes, slides or readings"}</div>
        <div className="text-xs text-ink-muted">{UPLOAD_TYPES_LABEL}. Up to 5 files, 10 MB each. They become context for the tutor, notes, practice paper and quiz.</div>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="mt-1 cursor-pointer rounded-sm border border-line-button bg-surface px-3.5 py-1.5 text-[13px] font-semibold hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60">Choose files</button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
        {result?.added.map((a) => <p key={a.id} className="m-0 text-xs text-mastered-text">Added {a.name}, {a.words.toLocaleString("en-US")} words{a.readBy === "ai" ? ", read by the AI" : ""}.</p>)}
        {result?.failed.map((f) => <p key={f.name} role="alert" className="m-0 text-xs text-needswork-text">{f.reason}</p>)}
      </div>

      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-line p-0">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <FileText size={16} strokeWidth={1.8} className="shrink-0 text-ink-muted" aria-hidden />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{f.name}</div><div className="text-xs text-ink-muted">{f.detail}</div></div>
            <span className="shrink-0 text-xs text-ink-faint">{f.kind}</span>
            {f.removable && (
              <button type="button" onClick={() => void remove(f.id)} aria-label={`Remove ${f.name}`} title="Remove" className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink"><Trash2 size={14} aria-hidden /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
