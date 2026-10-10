"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { api } from "@proveit/lib/api";
import { cn } from "@proveit/lib/cn";
import { Button, buttonStyles } from "../Button";
import { Modal } from "./Modal";

const ACCEPT = ".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,image/png,image/jpeg,image/webp";
const MAX_FILES = 5;
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Opened with /?add=1. Uploaded syllabus, slides or notes become a concept map. */
export function AddCourseModal() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [rights, setRights] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    const known = new Set(files.map((f) => `${f.name}:${f.size}`));
    const next = [...files, ...Array.from(list).filter((f) => !known.has(`${f.name}:${f.size}`))];
    setFiles(next.slice(0, MAX_FILES));
    setError(next.length > MAX_FILES ? `Only the first ${MAX_FILES} files were kept.` : null);
  };

  const ready = name.trim() !== "" && files.length > 0 && rights && !busy;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const { courseId } = await api.uploadCourse(name.trim(), files);
      router.push(`/course/${courseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Building the concept map failed. Retry.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Add a course" closeHref="/">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
          <label htmlFor="cname" className="text-[13px] font-semibold">Course name</label>
          <input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Linear Algebra" className="rounded-sm border border-line bg-surface px-3 py-2.5 text-sm" />
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
            className={cn("flex cursor-pointer flex-col items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-3.5 py-[18px] text-center", dragging ? "border-ink bg-surface-hover" : "border-line bg-surface-subtle")}
          >
            <Upload size={22} strokeWidth={1.8} aria-hidden />
            <span className="text-[13px] font-semibold">Drop syllabus, slides, or study guides</span>
            <span className="text-xs text-ink-faint">or click to choose. PDF, TXT, Markdown or images, up to {MAX_FILES} files</span>
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          {files.length > 0 && (
            <ul aria-label="Chosen files" className="m-0 flex list-none flex-col gap-1 p-0">
              {files.map((f) => (
                <li key={`${f.name}:${f.size}`} className="flex items-center gap-2 rounded-sm border border-line px-2.5 py-1.5 text-xs">
                  <FileText size={13} aria-hidden className="shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-ink-faint">{size(f.size)}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))} className="flex cursor-pointer border-0 bg-transparent p-0.5 text-ink-muted"><X size={12} aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-start gap-2 text-xs text-ink-muted"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-ink" />I have the right to use these files for my own studying.</label>
        </fieldset>
        {error && <p role="alert" className="m-0 rounded-sm border border-needswork-line bg-needswork-bg px-3 py-2 text-xs text-needswork-text">{error}</p>}
        <div className="flex justify-end gap-2">
          <Link href="/" className={buttonStyles({ variant: "secondary" })}>Cancel</Link>
          <Button type="submit" disabled={!ready}>{busy ? "Building map..." : "Build concept map"}</Button>
        </div>
      </form>
    </Modal>
  );
}
