"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ChevronRight, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ButtonLink } from "@/components/ui/button";
import { NAV_BODY_TYPES, BODY_TYPE_LABELS, BUDGET_BANDS, bodyTypeHref, budgetHref, makeHref } from "@/lib/nav";
import type { Make } from "@/lib/domain";

const PRIMARY = [
  { href: "/sell-your-car", label: "Sell your car" },
  { href: "/finance", label: "Finance" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const groupHeading = "px-3 pb-1 pt-5 text-sm font-semibold text-foreground";
const groupLink = "flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-body hover:bg-muted";

/** Mobile navigation sheet (< lg): 44 px rows, primary links first, then the browse shortcuts. */
export function MobileNav({ makes, phone }: { makes: Make[]; phone: string | null }) {
  const [open, setOpen] = useState(false);
  const popularMakes = makes.filter((m) => m.isPopular).slice(0, 8);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open menu" className="inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-white/10 lg:hidden">
        <Menu className="size-6" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[85%] max-w-sm overflow-y-auto bg-card p-0 text-card-foreground">
        <SheetTitle className="border-b border-border p-4 text-lg font-semibold">Menu</SheetTitle>
        <nav className="flex flex-col p-2" aria-label="Site" onClick={() => setOpen(false)}>
          <ButtonLink href="/used-cars" variant="accent" size="lg" className="mx-1 my-2">
            Browse cars for sale
          </ButtonLink>

          {PRIMARY.map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-12 items-center justify-between rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-muted">
              {item.label}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}

          {popularMakes.length > 0 ? (
            <>
              <p className={groupHeading}>Popular makes</p>
              <div className="grid grid-cols-2 gap-1">
                {popularMakes.map((m) => (
                  <Link key={m.slug} href={makeHref(m.slug)} className={groupLink}>
                    {m.name}
                  </Link>
                ))}
              </div>
            </>
          ) : null}

          <p className={groupHeading}>Body type</p>
          <div className="grid grid-cols-2 gap-1">
            {NAV_BODY_TYPES.map((b) => (
              <Link key={b} href={bodyTypeHref(b)} className={groupLink}>
                {BODY_TYPE_LABELS[b]}
              </Link>
            ))}
          </div>

          <p className={groupHeading}>Budget</p>
          <div className="grid grid-cols-2 gap-1">
            {BUDGET_BANDS.map((b) => (
              <Link key={b.max} href={budgetHref(b.max)} className={groupLink}>
                {b.label}
              </Link>
            ))}
          </div>
        </nav>

        {phone ? (
          <div className="sticky bottom-0 mt-auto border-t border-border bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover">
              <Phone className="size-5" aria-hidden="true" /> Call {phone}
            </a>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
