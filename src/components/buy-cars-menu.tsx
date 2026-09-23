"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NAV_BODY_TYPES, BODY_TYPE_LABELS, BUDGET_BANDS, bodyTypeHref, budgetHref, makeHref } from "@/lib/nav";
import type { Make } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * "Buy cars" disclosure menu for the desktop header.
 *
 * A real button with aria-expanded/aria-controls — opens on click and on
 * keyboard, closes on Escape, on focus leaving the menu, and on outside
 * click — instead of the previous hover-only mega-menu that touch and keyboard
 * users could not reach. The trigger itself links to /used-cars on Enter when
 * the menu is already open, so "Buy cars" is never a dead end.
 */
export function BuyCarsMenu({ makes }: { makes: Make[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const popularMakes = makes.filter((m) => m.isPopular).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted aria-expanded:bg-muted"
      >
        Buy cars
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute left-0 top-full z-[var(--z-float)] mt-2 w-[40rem] rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-float"
      >
        <div className="grid grid-cols-3 gap-8">
          <MenuColumn title="Popular makes">
            {popularMakes.map((m) => (
              <MenuLink key={m.slug} href={makeHref(m.slug)} onNavigate={() => setOpen(false)}>
                {m.name}
              </MenuLink>
            ))}
          </MenuColumn>
          <MenuColumn title="Body type">
            {NAV_BODY_TYPES.map((b) => (
              <MenuLink key={b} href={bodyTypeHref(b)} onNavigate={() => setOpen(false)}>
                {BODY_TYPE_LABELS[b]}
              </MenuLink>
            ))}
          </MenuColumn>
          <MenuColumn title="Budget">
            {BUDGET_BANDS.map((b) => (
              <MenuLink key={b.max} href={budgetHref(b.max)} onNavigate={() => setOpen(false)}>
                {b.label}
              </MenuLink>
            ))}
          </MenuColumn>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <Link href="/used-cars" onClick={() => setOpen(false)} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
            See all cars
          </Link>
        </div>
      </div>
    </div>
  );
}

function MenuColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function MenuLink({ href, children, onNavigate }: { href: string; children: React.ReactNode; onNavigate: () => void }) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} className="block rounded-md px-2 py-1.5 text-sm text-body transition-colors hover:bg-muted hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
