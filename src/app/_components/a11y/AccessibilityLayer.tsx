"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyA11y } from "@proveit/lib/a11y";
import { useSettings } from "@proveit/lib/settings";
import { LineFocus } from "./LineFocus";
import { ReadAloudControl } from "./ReadAloudControl";
import { stopReading } from "./readAloud";

const noop = () => () => {};

/**
 * Keeps <html> in step with the accessibility settings and mounts the line focus band and read-aloud control.
 * Lives outside the zoomed app wrapper, so its overlays stay at normal scale and line up with the pointer.
 */
export function AccessibilityLayer() {
  const [s] = useSettings();
  // The hydration render sees default settings; applying those would undo the boot script for a frame.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => { if (hydrated) applyA11y(document.documentElement, s); }, [hydrated, s]);
  useEffect(() => { if (!s.readAloud) stopReading(); }, [s.readAloud]);
  if (!hydrated) return null;
  return (
    <>
      {s.lineFocus && <LineFocus />}
      {s.readAloud && <ReadAloudControl rate={s.readAloudRate} />}
    </>
  );
}
