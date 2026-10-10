import { cn } from "@proveit/lib/cn";

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors duration-200", checked ? "bg-ink" : "bg-line")}>
      <span className={cn("absolute top-[3px] size-5 rounded-full bg-white transition-[left] duration-200", checked ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}
