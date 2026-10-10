"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, RefreshCw, Unplug } from "lucide-react";
import { api } from "@proveit/lib/api";
import { Button, buttonStyles } from "../Button";

/** Connect, refresh and disconnect. Refresh re-reads the feed, so a professor's change shows up without reconnecting. */
export function CalendarControls({ connected, connectHref, compact = false }: { connected: boolean; connectHref: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"refresh" | "disconnect" | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  async function run(kind: "refresh" | "disconnect") {
    setBusy(kind);
    setNote(null);
    try {
      await (kind === "refresh" ? api.refreshCalendar() : api.disconnectCalendar());
      setNote({ text: kind === "refresh" ? "Calendar refreshed." : "Calendar disconnected.", error: false });
      router.refresh();
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Something went wrong. Retry.", error: true });
    }
    setBusy(null);
  }

  return (
    <div className={compact ? "relative" : "flex flex-col gap-2"}>
      <div className="flex flex-wrap gap-2">
        <Link href={connectHref} className={buttonStyles({ variant: connected ? "secondary" : "primary", size: "sm" })}><CalendarPlus size={13} aria-hidden />{connected ? "Change calendar" : "Connect calendar"}</Link>
        <Button size="sm" variant="secondary" onClick={() => run("refresh")} disabled={busy !== null}><RefreshCw size={13} aria-hidden className={busy === "refresh" ? "animate-spin" : ""} />{busy === "refresh" ? "Refreshing..." : "Refresh calendar"}</Button>
        {connected && <Button size="sm" variant="secondary" onClick={() => run("disconnect")} disabled={busy !== null}><Unplug size={13} aria-hidden />Disconnect</Button>}
      </div>
      <div aria-live="polite" className={compact ? "absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-sm bg-surface px-1 text-xs" : "min-h-4 text-xs"}>
        {note && <span className={note.error ? "text-needswork-text" : "text-ink-muted"}>{note.text}</span>}
      </div>
    </div>
  );
}
