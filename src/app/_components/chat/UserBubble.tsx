import { cn } from "@proveit/lib/cn";

export function UserBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-[72%] self-end rounded-[14px_14px_4px_14px] bg-surface-active px-3.5 py-2.5 text-sm leading-normal", className)}>{children}</div>;
}
