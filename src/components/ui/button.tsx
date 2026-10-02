import * as React from "react";
import Link from "next/link";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Buttons — DESIGN.md §6.
 *  primary     navy fill: the default action on a page
 *  accent      azure fill: the page's single conversion action ("Enquire", "Issue invoice")
 *  outline     bordered, for secondary actions
 *  secondary   soft fill, for grouped/tertiary actions
 *  ghost       text-only, for toolbars and table rows
 *  destructive tinted red text; use `variant="destructive-solid"` only inside a confirmation dialog
 *  link        inline text link styling
 * Focus rings come from the global :focus-visible outline; nothing here re-implements them.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-bold tracking-wide transition-all duration-200 select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger hover:scale-[1.02] active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
        accent: "bg-accent text-white shadow-md shadow-accent/30 hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/40",
        outline: "border-border bg-card text-foreground hover:border-accent/30 hover:bg-accent/5 aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-neutral-100 aria-expanded:bg-neutral-100 hover:scale-100 active:scale-100 rounded-lg",
        destructive: "bg-danger-soft text-danger hover:bg-danger hover:text-destructive-foreground hover:scale-100",
        "destructive-solid": "bg-destructive text-destructive-foreground hover:opacity-90 shadow-sm hover:scale-100",
        link: "h-auto rounded-none px-0 text-accent font-semibold underline-offset-4 hover:underline hover:scale-100 active:scale-100",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 gap-1.5 px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-base",
        cta: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner in place of the leading icon and disables the control; the label stays visible. */
    loading?: boolean;
  };

function Button({ className, variant = "default", size = "default", loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </ButtonPrimitive>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/** A Next.js <Link> styled as a button — for navigation that looks like an action ("Browse cars"). */
function ButtonLink({ className, variant = "default", size = "default", ...props }: ButtonLinkProps) {
  return <Link data-slot="button-link" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, ButtonLink, buttonVariants };
