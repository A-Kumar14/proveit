import { cn } from "@proveit/lib/cn";

/** Shimmer placeholder for AI text that hasn't streamed in yet. Motion stops under prefers-reduced-motion. */
export const Skeleton = ({ className }: { className?: string }) => <span aria-hidden className={cn("skeleton inline-block h-3 w-full align-middle", className)} />;
