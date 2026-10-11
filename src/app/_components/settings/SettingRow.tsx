/** `stacked` puts the control under the text, for controls too wide to sit beside it. */
export function SettingRow({ title, description, children, stacked = false }: { title: string; description: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <div className={stacked ? "flex flex-col gap-3 border-b border-line py-4 last:border-b-0" : "flex items-center justify-between gap-6 border-b border-line py-4 last:border-b-0"}>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 max-w-md text-[0.8125rem] text-ink-muted">{description}</div>
      </div>
      <div className={stacked ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}
