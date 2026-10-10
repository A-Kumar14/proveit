"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, LoaderCircle, Upload, X } from "lucide-react";
import { api } from "@proveit/lib/api";
import type { CourseJobView } from "@proveit/lib/schemas";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";
import { useConnect, type AppStatus } from "../apps/useConnect";
import { BuildProgress } from "./BuildProgress";
import { UPLOAD_ACCEPT, UPLOAD_TYPES_LABEL } from "@proveit/lib/uploadTypes";

const field = "w-full rounded-sm border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-ink-faint";

function UploadCourse() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<CourseJobView | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | File[]) => setFiles((cur) => {
    const known = new Set(cur.map((f) => `${f.name}:${f.size}`));
    return [...cur, ...Array.from(list).filter((f) => !known.has(`${f.name}:${f.size}`))].slice(0, 5);
  });

  // Follows the build once a second, until it finishes, fails or is cancelled.
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let misses = 0;
    const tick = async () => {
      try {
        const j = await api.courseJob(jobId);
        if (stop) return;
        misses = 0;
        setJob(j);
        if (j.stage === "done" && j.courseId) { router.push(`/course/${j.courseId}?built=1`); router.refresh(); return; }
        if (j.stage === "failed" || j.stage === "cancelled" || j.stage === "done") { setBusy(false); setJobId(null); return; }
      } catch {
        if (!stop && ++misses >= 6) { setError("Lost contact with the server. The build may still finish, so check your courses in a minute."); setBusy(false); setJobId(null); return; }
      }
      if (!stop) setTimeout(tick, 1000);
    };
    void tick();
    return () => { stop = true; };
  }, [jobId, router]);

  async function build() {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const { jobId: id } = await api.uploadCourse(name.trim(), files);
      setJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the build. Retry.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (jobId) await api.cancelCourseJob(jobId).catch(() => null);
  }

  return (
    <section aria-label="Upload your notes" className="flex flex-col gap-2.5">
      <h3 className="m-0 text-sm font-semibold">Upload your notes</h3>
      <fieldset disabled={busy} className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <label htmlFor="cname" className="text-xs text-ink-muted">Course name</label>
        <input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Linear Algebra" className={field} />
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
          className={cn("flex flex-col items-center gap-1.5 rounded-md border-[1.5px] border-dashed px-3.5 py-4 text-center", over ? "border-ink bg-surface-hover" : "border-line bg-surface-subtle")}
        >
          <input ref={input} type="file" multiple accept={UPLOAD_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose notes" onChange={(e) => { if (e.target.files) add(e.target.files); if (input.current) input.current.value = ""; }} />
          <Upload size={20} strokeWidth={1.8} aria-hidden />
          <span className="text-[13px] font-semibold">Drop a syllabus, slides or study notes</span>
          <span className="text-xs text-ink-faint">{UPLOAD_TYPES_LABEL}. Up to 5 files, 10 MB each. Markdown with ## and ### headings keeps your own structure.</span>
          <button type="button" onClick={() => input.current?.click()} className="cursor-pointer rounded-sm border border-line-button bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-hover">Choose files</button>
        </div>
        {files.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-line bg-surface-hover px-2.5 py-0.5 text-[11px] text-ink-3"><FileText size={11} aria-hidden />{f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="flex cursor-pointer border-0 bg-transparent p-0 text-ink-3"><X size={11} aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-start gap-2 text-xs text-ink-muted"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 accent-ink" />I have the right to use these files for my own studying.</label>
      </fieldset>
      {busy && !job && <p role="status" className="m-0 flex items-center gap-2 text-xs text-ink-muted"><LoaderCircle size={13} className="animate-spin" aria-hidden />Uploading your files...</p>}
      {job && <BuildProgress job={job} onCancel={jobId ? () => void cancel() : undefined} />}
      {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
      <button type="button" onClick={() => void build()} disabled={busy || !ok || !name.trim() || files.length === 0} className={cn(buttonStyles(), "w-fit cursor-pointer")}>
        {busy && <LoaderCircle size={14} className="animate-spin" aria-hidden />}{busy ? "Building map..." : job && job.stage !== "done" ? "Try again" : "Build concept map"}
      </button>
    </section>
  );
}

function ImportApp({ app, connect }: { app: AppStatus; connect: ReturnType<typeof useConnect> }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [how, setHow] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const made = await api.importFromApp(app.id, topic, name || undefined);
      router.push(`/course/${made.id}?built=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed. Retry.");
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2.5 rounded-md border border-line p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><div className="text-sm font-semibold">{app.name}</div><div className="text-xs leading-normal text-ink-muted">{app.blurb}</div></div>
        {app.connected
          ? <button type="button" onClick={() => void connect.disconnect(app.id)} disabled={connect.busy === app.id} className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-xs text-ink-muted underline hover:text-ink">Disconnect</button>
          : <button type="button" onClick={() => void connect.connect(app.id)} disabled={connect.busy === app.id} className={cn(buttonStyles({ size: "sm" }), "shrink-0 cursor-pointer")}>{connect.busy === app.id && <LoaderCircle size={12} className="animate-spin" aria-hidden />}Connect {app.name}</button>}
      </div>
      {!app.connected && (
        <div className="text-xs leading-normal text-ink-muted">
          <button type="button" onClick={() => setHow((h) => !h)} aria-expanded={how} className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs text-ink-3"><ChevronDown size={12} className={cn("transition-transform", how && "rotate-180")} aria-hidden />How this works</button>
          {how && (
            <ol className="m-0 mt-1.5 flex flex-col gap-1 pl-4">
              <li>Connect. You sign in on {app.name}&apos;s own page, so we never see your password.</li>
              <li>Tell us what the course is about, for example &ldquo;organic chemistry&rdquo;.</li>
              <li>An assistant searches your {app.name} notes with read-only access, writes them up as markdown, and builds a course from them.</li>
              <li>You can add more files later, and disconnect any time from your Account page.</li>
            </ol>
          )}
          <div className="mt-1 text-[11px] text-ink-faint">{app.needs}</div>
        </div>
      )}
      {app.connected && (
        <div className="flex flex-col gap-2">
          <input aria-label={`Topic to import from ${app.name}`} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is the course about? e.g. Organic chemistry" className={field} disabled={busy} />
          <input aria-label="Course name, optional" value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name (optional)" className={field} disabled={busy} />
          {error && <p role="alert" className="m-0 text-xs text-needswork-text">{error}</p>}
          <button type="button" onClick={() => void run()} disabled={busy || topic.trim().length < 2} className={cn(buttonStyles(), "w-fit cursor-pointer")}>
            {busy && <LoaderCircle size={14} className="animate-spin" aria-hidden />}{busy ? `Reading your ${app.name} notes...` : "Import notes and build course"}
          </button>
        </div>
      )}
    </li>
  );
}

export function AddCourseForm({ apps, notice }: { apps: AppStatus[]; notice?: { connected?: string; error?: string } }) {
  const connect = useConnect("/?add=1");
  return (
    <div className="flex flex-col gap-5">
      <UploadCourse />
      <section aria-label="Import from your apps" className="flex flex-col gap-2.5">
        <h3 className="m-0 text-sm font-semibold">Import from your apps</h3>
        {notice?.connected && <p role="status" className="m-0 text-xs text-mastered-text">Connected {apps.find((a) => a.id === notice.connected)?.name ?? "the app"}. Tell it what the course is about.</p>}
        {(notice?.error || connect.error) && <p role="alert" className="m-0 text-xs text-needswork-text">{connect.error ?? notice?.error}</p>}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {apps.map((a) => <ImportApp key={a.id} app={a} connect={connect} />)}
        </ul>
      </section>
    </div>
  );
}
