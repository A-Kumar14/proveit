/** Three pulsing dots shown in an assistant message while a reply is on its way. */
export function Typing() {
  return (
    <div role="status" aria-label="Thinking" className="flex h-[30px] w-fit items-center gap-1.5 rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5">
      {[0, 0.2, 0.4].map((d) => <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-faint" style={{ animationDelay: `${d}s` }} />)}
    </div>
  );
}
