import { cn } from "@proveit/lib/cn";

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; style?: React.CSSProperties }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex w-fit flex-wrap gap-1 rounded-sm border border-line bg-surface-sidebar p-[3px]">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} style={o.style}
          className={cn("cursor-pointer rounded-[7px] border px-3 py-[7px] text-[0.8125rem]", o.value === value ? "border-line-button bg-surface font-semibold text-ink" : "border-transparent bg-transparent font-medium text-ink-3")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
