"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";
import { SettingRow } from "./SettingRow";

const CHAT_KEY = /^proveit\.session\./;

/** Take your data, clear it from this device, or start a course over. Anything that deletes asks first. */
export function DataSettings({ courses }: { courses: { id: string; name: string }[] }) {
  const router = useRouter();
  const [cleared, setCleared] = useState<number | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const course = courses.find((c) => c.id === courseId);

  function clearChats() {
    let n = 0;
    try {
      for (const key of Object.keys(sessionStorage)) if (CHAT_KEY.test(key)) { sessionStorage.removeItem(key); n++; }
    } catch { /* storage blocked: nothing to clear */ }
    setCleared(n);
  }

  async function reset() {
    if (!course || typed.trim() !== course.name) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/courses/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId }) });
      if (!res.ok) throw new Error();
      setMsg(`${course.name} is back to the start.`);
      setTyped("");
      router.refresh();
    } catch {
      setMsg("Couldn't reset that course. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="m-0 mb-1 text-lg font-semibold">Data and privacy</h2>
      <SettingRow title="Download your data" description="Your courses, concept states, answers, quiz scores, and these settings, as one JSON file.">
        <a href="/api/account/export" download className={cn(buttonStyles({ variant: "secondary" }), "no-underline")}><Download size={14} aria-hidden />Download</a>
      </SettingRow>
      <SettingRow title="Clear tutor chats on this device" description="Removes the saved conversation with the tutor from this browser. Your progress and rank are not touched.">
        <div className="flex items-center gap-3">
          {cleared !== null && <span role="status" className="text-xs text-ink-muted">{cleared === 0 ? "Nothing saved." : `Cleared ${cleared}.`}</span>}
          <button type="button" onClick={clearChats} className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer")}>Clear chats</button>
        </div>
      </SettingRow>
      <SettingRow stacked title="Start a course over" description="Puts every concept back to Not started and removes its answers and quizzes. Rank points you already earned stay. This can't be undone.">
        {courses.length === 0 ? <p className="m-0 text-xs text-ink-muted">No courses yet.</p> : (
          <div className="flex max-w-md flex-col gap-2">
            <label htmlFor="reset-course" className="text-xs text-ink-muted">Course</label>
            <select id="reset-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setTyped(""); setMsg(null); }} className="rounded-sm border border-line bg-surface px-3 py-2 text-sm">
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label htmlFor="reset-confirm" className="text-xs text-ink-muted">Type <strong>{course?.name}</strong> to confirm</label>
            <input id="reset-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="rounded-sm border border-line bg-surface px-3 py-2 text-sm" />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => void reset()} disabled={busy || typed.trim() !== course?.name} className={cn(buttonStyles(), "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50")}>Start over</button>
              {msg && <span role="status" className="text-xs text-ink-muted">{msg}</span>}
            </div>
          </div>
        )}
      </SettingRow>
    </>
  );
}
