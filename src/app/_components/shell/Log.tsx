export function Log({ children }: { children: React.ReactNode }) {
  return (
    <div role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-7 py-[18px]">
      {children}
    </div>
  );
}
