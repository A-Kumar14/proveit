import { Award, Crown, Gem, Medal, Shield, Star, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@proveit/lib/cn";

/** One icon shape per tier, so rank never depends on color alone. */
export const TIER_ICON: Record<string, LucideIcon> = { bronze: Shield, silver: Medal, gold: Award, platinum: Star, diamond: Gem, master: Crown, legend: Trophy };

/** One color per tier: the metal or stone it's named after. `fg` is readable on the gradient, `soft` and `line` tint surfaces around it. */
export const TIER_COLORS: Record<string, { from: string; to: string; fg: string; soft: string; line: string; text: string }> = {
  bronze: { from: "#d08a4f", to: "#8a4f1f", fg: "#ffffff", soft: "#f8efe7", line: "#e8cdb8", text: "#8a4f1f" },
  silver: { from: "#d6dbe0", to: "#8f99a3", fg: "#1f1f1f", soft: "#f2f4f6", line: "#d2d8de", text: "#5c6771" },
  gold: { from: "#f1c84b", to: "#b8860b", fg: "#3a2a00", soft: "#fbf4dc", line: "#eed9a0", text: "#9a6a00" },
  platinum: { from: "#d8e8ee", to: "#7fa3b3", fg: "#15303a", soft: "#eef5f8", line: "#c5dbe3", text: "#4f7584" },
  diamond: { from: "#8fdcff", to: "#2a8fd0", fg: "#ffffff", soft: "#e9f6fd", line: "#b9e2f7", text: "#1f7bb8" },
  master: { from: "#b48cf2", to: "#5b2fb8", fg: "#ffffff", soft: "#f1ebfb", line: "#d6c4f3", text: "#5b2fb8" },
  legend: { from: "#ff9a4d", to: "#d6336c", fg: "#ffffff", soft: "#fdeef0", line: "#f7c7d2", text: "#c22a5e" },
};
export const tierColor = (id: string) => TIER_COLORS[id] ?? TIER_COLORS.bronze!;

export function TierBadge({ id, size = 40, filled = true, className, style }: { id: string; size?: number; filled?: boolean; className?: string; style?: React.CSSProperties }) {
  const Icon = TIER_ICON[id] ?? Shield;
  const c = tierColor(id);
  return (
    <span aria-hidden style={{ ...style, width: size, height: size, ...(filled
      ? { background: `linear-gradient(145deg, ${c.from}, ${c.to})`, color: c.fg, borderColor: "rgba(255,255,255,0.6)", boxShadow: `0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35), 0 0 0 1px ${c.line}` }
      : { borderColor: c.line, color: c.text, background: c.soft }) }}
      className={cn("flex shrink-0 items-center justify-center rounded-full border", !filled && "border-dashed opacity-80", className)}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={1.8} />
    </span>
  );
}
