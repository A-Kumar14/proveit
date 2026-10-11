"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@proveit/lib/api";
import { Button } from "../Button";

export function ConnectForm({ doneHref }: { doneHref: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.connectCalendar(url);
      router.push(doneHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Retry.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="m-0 text-[0.8125rem] leading-normal text-ink-muted">Paste your calendar&apos;s private iCal link. Google, Apple and Outlook calendars all give you one. Refresh re-reads it, so changes your professor makes show up here.</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-ink-3">
        <li><b className="font-semibold">Google.</b> Settings, your calendar, Integrate calendar, then Secret address in iCal format.</li>
        <li><b className="font-semibold">Apple.</b> Calendar app, Share Calendar, Public Calendar, then copy the link.</li>
        <li><b className="font-semibold">Outlook.</b> Settings, Shared calendars, Publish a calendar, then copy the ICS link.</li>
      </ul>
      <label htmlFor="ics" className="text-[0.8125rem] font-semibold">Calendar link</label>
      <input id="ics" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..." autoComplete="off" spellCheck={false}
        className="rounded-sm border border-line bg-surface px-3 py-2.5 text-sm" />
      {error && <div role="alert" className="text-xs text-needswork-text">{error}</div>}
      <p className="m-0 text-[0.6875rem] text-ink-faint">Anyone with this link can read the calendar, so don&apos;t share it. It&apos;s kept in server memory, never shown again, and lost on restart.</p>
      <div className="flex justify-end"><Button type="submit" disabled={busy || !url.trim()}>{busy ? "Connecting..." : "Connect"}</Button></div>
    </form>
  );
}
