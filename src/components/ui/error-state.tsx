"use client";

import { AlertTriangle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  /** Says what happened and what to do — never just "error". */
  message?: string;
  /** Renders a "Try again" button when provided (route `error.tsx` passes `reset`). */
  onRetry?: () => void;
  /** Where "Go back" leads; defaults to the homepage. */
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}

/**
 * Error state — DESIGN.md §6. Announced assertively; the retry button is
 * always enabled so a transient failure never dead-ends the person.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this page. Try again, or come back in a moment.",
  onRetry,
  homeHref = "/",
  homeLabel = "Go to the homepage",
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" aria-live="assertive" className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
        <AlertTriangle className="size-7" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-body">{message}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <ButtonLink href={homeHref} variant={onRetry ? "ghost" : "default"}>
          {homeLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
