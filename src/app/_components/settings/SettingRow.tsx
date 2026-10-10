export function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 max-w-md text-[13px] text-ink-muted">{description}</div>
      </div>
      {children}
    </div>
  );
}
