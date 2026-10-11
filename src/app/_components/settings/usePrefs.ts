"use client";

import { useCallback, useState } from "react";
import type { Prefs } from "@proveit/lib/prefs";

/** Account choices. A change shows at once and is saved to the account. If saving fails, the old value comes back. */
export function usePrefs(initial: Prefs) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const update = useCallback(async (patch: Partial<Prefs>) => {
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    setError(null);
    try {
      const res = await fetch("/api/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error();
      setPrefs((await res.json()) as Prefs);
    } catch {
      setPrefs(before);
      setError("Couldn't save that. Try again.");
    }
  }, [prefs]);
  return { prefs, update, error };
}
