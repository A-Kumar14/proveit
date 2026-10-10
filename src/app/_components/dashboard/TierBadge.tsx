import { Award, Crown, Gem, Medal, Shield, Star, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@proveit/lib/cn";

/** One icon shape per tier, so rank never depends on color alone. */
export const TIER_ICON: Record<string, LucideIcon> = { bronze: Shield, silver: Medal, gold: Award, platinum: Star, diamond: Gem, master: Crown, legend: Trophy };

export function TierBadge({ id, size = 40, filled = true, className }: { id: string; size?: number; filled?: boolean; className?: string }) {
  const Icon = TIER_ICON[id] ?? Shield;
  return (
    <span aria-hidden style={{ width: size, height: size }} className={cn("flex shrink-0 items-center justify-center rounded-full border", filled ? "border-ink bg-ink text-white" : "border-dashed border-line-button bg-surface text-ink-faint", className)}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={1.8} />
    </span>
  );
}
