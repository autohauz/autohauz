import * as React from "react";

import { cn } from "@/lib/utils";

type ContainerProps = React.ComponentProps<"div"> & {
  /** `page` 1280 (public), `wide` 1440 (admin tables), `prose` 44rem (long-form). */
  width?: "page" | "wide" | "prose";
};

const widths = {
  page: "max-w-[var(--container-page)]",
  wide: "max-w-[var(--container-wide)]",
  prose: "max-w-[var(--container-prose)]",
} as const;

/** Horizontal container with the DESIGN.md §4 gutters (16 / 24 / 32 px). */
function Container({ width = "page", className, ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[width], className)} {...props} />;
}

type SectionProps = React.ComponentProps<"section"> & {
  /** Vertical rhythm: `default` 64/96 px, `tight` 40/56 px. */
  spacing?: "default" | "tight" | "none";
  /** Dark surface (hero/footer bands) — flips the token scheme for the subtree. */
  dark?: boolean;
};

/** Page section with vertical rhythm; combine with <Container> inside. */
function Section({ spacing = "default", dark = false, className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        spacing === "default" && "py-16 lg:py-24",
        spacing === "tight" && "py-10 lg:py-14",
        dark && "dark bg-background text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action(s) rendered on the right (≥ sm). */
  actions?: React.ReactNode;
  /** Breadcrumb or eyebrow content rendered above the title. */
  above?: React.ReactNode;
  className?: string;
};

/** Standard page header: title with the speed-line, optional description and actions. */
function PageHeader({ title, description, actions, above, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {above}
        <h1 className="speed-line">{title}</h1>
        {description ? <p className="mt-3 max-w-prose text-body">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export { Container, Section, PageHeader };
