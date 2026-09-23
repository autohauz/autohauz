import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

/**
 * Text input — DESIGN.md §6. 44 px on phones (16 px font stops iOS zoom),
 * 40 px from md. Focus comes from the global :focus-visible outline plus an
 * accent border so the field reads as active even in forced-colours mode.
 */
export const inputClassName =
  "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-accent-bright disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger md:h-10 md:text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <InputPrimitive type={type} data-slot="input" className={cn(inputClassName, className)} {...props} />;
}

export { Input };
