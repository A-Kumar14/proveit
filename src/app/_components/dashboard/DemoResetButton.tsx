"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "../Button";

export function DemoResetButton() {
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("reset failed");
      try { localStorage.removeItem("proveit.tier.celebrated"); } catch {}
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  }
  return <Button size="md" variant="secondary" onClick={reset} disabled={busy}><RotateCcw size={13} aria-hidden />{busy ? "Resetting..." : "Reset demo"}</Button>;
}
