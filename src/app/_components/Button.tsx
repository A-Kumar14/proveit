import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@proveit/lib/cn";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm text-[13px] no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border border-line-button bg-surface font-semibold text-ink hover:bg-surface-hover",
        secondary: "border border-line bg-transparent font-medium text-ink-3 hover:bg-surface-hover",
      },
      size: { md: "px-4 py-2", sm: "px-3 py-1.5 text-xs" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({ className, variant, size, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonStyles>) {
  return <button type="button" className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
