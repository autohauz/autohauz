import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-accent-bright disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
