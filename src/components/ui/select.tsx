import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native <select>, styled to match Input. Native is deliberate: it is the most
 * accessible picker on phones and needs no JavaScript. Use for ≤ ~30 options.
 */
type SelectProps = React.ComponentProps<"select"> & {
  /** Class for the positioning wrapper (the flex item), e.g. `flex-1 min-w-0`. */
  wrapperClassName?: string;
};

function Select({ className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <span className={cn("relative block", wrapperClassName)}>
      <select
        data-slot="select"
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2 pl-3 pr-9 text-base text-foreground transition-colors duration-150 focus-visible:border-accent-bright disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger md:h-10 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </span>
  );
}

export { Select };
