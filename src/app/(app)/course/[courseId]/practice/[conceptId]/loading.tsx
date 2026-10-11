import { LoaderCircle } from "lucide-react";

/** Shown while a concept's learning content is being written, which takes a few seconds the first time. */
export default function Loading() {
  return (
    <div role="status" className="flex h-full flex-1 flex-col items-center justify-center gap-3 text-center">
      <LoaderCircle size={22} strokeWidth={2} className="animate-spin text-ink-muted" aria-hidden />
      <div className="text-sm font-semibold">Getting your tutor ready</div>
      <p className="m-0 max-w-xs text-[0.8125rem] text-ink-muted">Reading your course material for this concept. The first time takes a few seconds.</p>
    </div>
  );
}
