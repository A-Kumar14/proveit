import { BarChart3 } from "lucide-react";

export function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-sm bg-ink">
        <BarChart3 size={15} strokeWidth={2.2} className="text-white" />
      </span>
      <div className="min-w-0 max-w-[780px] flex-1">{children}</div>
    </div>
  );
}
