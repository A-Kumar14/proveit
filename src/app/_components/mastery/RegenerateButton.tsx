"use client";

import { RefreshCw } from "lucide-react";
import { buttonStyles } from "../Button";

export const REGENERATE_EVENT = "proveit:regenerate-review";

/** Header action. The review card owns the stream, so this just asks it to run again. */
export function RegenerateButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(REGENERATE_EVENT))} className={buttonStyles({ variant: "primary" })}>
      <RefreshCw size={13} strokeWidth={2} aria-hidden />Regenerate review
    </button>
  );
}
