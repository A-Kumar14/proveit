import { cn } from "@proveit/lib/cn";

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-sm border border-line bg-surface-sidebar p-[3px]">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={cn("cursor-pointer rounded-[7px] border px-3 py-[7px] text-[13px]", o.value === value ? "border-line-button bg-surface font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-3")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
