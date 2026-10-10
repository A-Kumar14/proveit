"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@proveit/lib/api";

export type AppId = "granola" | "wispr";
export type AppStatus = { id: AppId; name: string; blurb: string; needs: string; connected: boolean };

/** Connect and disconnect for one app. Connecting sends the browser to the app's own sign-in page. */
export function useConnect(returnTo: string) {
  const router = useRouter();
  const [busy, setBusy] = useState<AppId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect(id: AppId) {
    setBusy(id);
    setError(null);
    try {
      const r = await api.connectApp(id, returnTo);
      if ("url" in r) { window.location.assign(r.url); return; }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the connection. Retry.");
    }
    setBusy(null);
  }

  async function disconnect(id: AppId) {
    setBusy(id);
    setError(null);
    try {
      await api.disconnectApp(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disconnect. Retry.");
    }
    setBusy(null);
  }

  return { busy, error, connect, disconnect };
}
