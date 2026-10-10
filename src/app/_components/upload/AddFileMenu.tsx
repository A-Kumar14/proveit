"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import type { UploadCheck } from "@proveit/lib/schemas";
import { api } from "@proveit/lib/api";

export type Checked = { name: string; check: UploadCheck };

/** Opens the file picker and posts the image to the upload check. */
export function AddFileMenu({ conceptId, disabled, onChecked, onError, buttonClassName, iconOnly }: {
  conceptId: string; disabled?: boolean; onChecked: (c: Checked) => void; onError: (message: string) => void; buttonClassName?: string; /** Icon-only round button for the composer. */ iconOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChecked({ name: file.name, check: await api.checkUpload(file, conceptId) });
    } catch (e) {
      onError(e instanceof Error ? e.message : "The upload check failed. Retry.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="relative">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Choose an image" onChange={(e) => pick(e.target.files?.[0])} />
      <button
        type="button" disabled={disabled || busy}
        onClick={() => input.current?.click()}
        aria-label={iconOnly ? "Add file" : undefined} title={iconOnly ? "Add a photo of your work" : undefined}
        className={buttonClassName ?? (iconOnly ? "flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-ink-3 hover:bg-surface-hover disabled:opacity-50" : "flex cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 py-[7px] text-xs font-semibold text-ink-2 hover:bg-surface-hover disabled:opacity-50")}
      >
        <Paperclip size={14} strokeWidth={2} aria-hidden />{iconOnly ? (busy ? <span className="sr-only">Checking...</span> : null) : busy ? "Checking..." : "Add file"}
      </button>

    </div>
  );
}
