import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyAction = { label: string; href: string } | { label: string; onClick: () => void };

type EmptyStateProps = {
  /** Icon element; defaults to a "nothing found" glyph. */
  icon?: ReactNode;
  title: string;
  /** Says what to do next, not just that there is nothing here. */
  description: string;
  action?: EmptyAction;
  secondaryAction?: EmptyAction;
  /** Heading level so the page outline stays sequential (h2 directly under a page title, h3 inside a titled section). */
  headingLevel?: "h2" | "h3";
  className?: string;
};

function ActionControl({ action, primary }: { action: EmptyAction; primary: boolean }) {
  const variant = primary ? "default" : "outline";
  return "href" in action ? (
    <ButtonLink href={action.href} variant={variant}>
      {action.label}
    </ButtonLink>
  ) : (
    <Button type="button" variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * Empty state — DESIGN.md §6: an invitation, not a dead end. Every list and
 * grid renders this when it has nothing to show. Server-safe unless an
 * `onClick` action is passed (then render it from a client component).
 */
function EmptyState({ icon, title, description, action, secondaryAction, headingLevel = "h2", className }: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground" aria-hidden="true">
        {icon ?? <SearchX className="size-7" />}
      </div>
      <Heading className="text-lg font-semibold text-foreground">{title}</Heading>
      <p className="mt-1 max-w-md text-sm text-body">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {action ? <ActionControl action={action} primary /> : null}
          {secondaryAction ? <ActionControl action={secondaryAction} primary={false} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps, EmptyAction };
