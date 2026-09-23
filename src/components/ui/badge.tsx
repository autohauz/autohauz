import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Chips / badges — DESIGN.md §6. Tinted background + saturated text; the text
 * is the status, colour only reinforces it. Never colour alone.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold leading-5 [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-soft text-accent-soft-foreground",
        neutral: "border-transparent bg-muted text-body",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        danger: "border-transparent bg-danger-soft text-danger",
        info: "border-transparent bg-info-soft text-info",
        outline: "border-border bg-transparent text-foreground",
        /** Solid navy — used sparingly, e.g. "Featured" over a photo. */
        solid: "border-transparent bg-primary text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
