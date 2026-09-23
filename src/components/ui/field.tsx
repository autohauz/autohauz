import * as React from "react";

import { cn } from "@/lib/utils";

type FieldProps = {
  id: string;
  label: React.ReactNode;
  /** Short helper text under the control. */
  hint?: React.ReactNode;
  /** Validation message; when set the control is marked invalid and the message is announced. */
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** Render prop receives the aria wiring to spread onto the control. */
  children: (control: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
    "aria-required": true | undefined;
  }) => React.ReactNode;
};

/**
 * Form field wrapper — DESIGN.md §6 / §10. The label is always visible; hint
 * and error are associated with the control via aria-describedby; errors use
 * role="alert" so screen readers announce them when they appear.
 */
function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
