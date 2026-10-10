"use client";

import Link from "next/link";
import { buttonStyles } from "../Button";
import { useVoiceSupport } from "./speech";

/** Header action on practice. Renders only where the browser can transcribe speech. */
export function SwitchToVoice({ href }: { href: string }) {
  const ok = useVoiceSupport();
  if (!ok) return null;
  return (
    <Link href={href} className={buttonStyles({ variant: "secondary", size: "sm" })}>
      <span aria-hidden className="flex h-3 items-center gap-[2px]">{[0, 0.15, 0.3].map((d) => <span key={d} className="wv h-3 w-[3px] rounded-[2px] bg-ink" style={{ animationDelay: `${d}s` }} />)}</span>
      Switch to voice
    </Link>
  );
}
