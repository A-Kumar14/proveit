"use client";

import { Link2, LoaderCircle } from "lucide-react";
import { cn } from "@proveit/lib/cn";
import { buttonStyles } from "../Button";
import { useConnect, type AppStatus } from "./useConnect";

/** The apps that can feed notes into a course, with connect and disconnect. Used on the account page. */
export function ConnectedApps({ apps, notice }: { apps: AppStatus[]; notice?: { connected?: string; error?: string } }) {
  const { busy, error, connect, disconnect } = useConnect("/account");
  return (
    <section aria-label="Connected apps" className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-base font-semibold">Connected apps</h2>
        <p className="m-0 mt-1 text-[0.8125rem] leading-normal text-ink-muted">Connect an app and we can turn your notes and transcripts into a course. You sign in on the app&apos;s own page, so we never see your password. Access is read-only, and you can disconnect at any time.</p>
      </div>
      {notice?.connected && <p role="status" className="m-0 text-xs text-mastered-text">Connected {apps.find((a) => a.id === notice.connected)?.name ?? "the app"}.</p>}
      {(notice?.error || error) && <p role="alert" className="m-0 text-xs text-needswork-text">{error ?? notice?.error}</p>}
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-line p-0">
        {apps.map((a) => (
          <li key={a.id} className="flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <Link2 size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold">{a.name}<span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", a.connected ? "bg-mastered-bg text-mastered-text" : "bg-surface-hover text-ink-3")}>{a.connected ? "Connected" : "Not connected"}</span></div>
              <div className="text-xs leading-normal text-ink-muted">{a.blurb}</div>
              {!a.connected && <div className="mt-0.5 text-[0.6875rem] leading-normal text-ink-faint">{a.needs}</div>}
            </div>
            {a.connected
              ? <button type="button" onClick={() => void disconnect(a.id)} disabled={busy === a.id} className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "cursor-pointer")}>Disconnect</button>
              : <button type="button" onClick={() => void connect(a.id)} disabled={busy === a.id} className={cn(buttonStyles({ size: "sm" }), "cursor-pointer")}>{busy === a.id && <LoaderCircle size={12} className="animate-spin" aria-hidden />}Connect</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
