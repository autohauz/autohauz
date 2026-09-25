import Link from "next/link";
import { Phone } from "lucide-react";
import { getMakes } from "@/lib/data/inventory";
import { getBusinessProfile } from "@/lib/data/business";
import { BrandLogo } from "@/components/brand-logo";
import { BuyCarsMenu } from "@/components/buy-cars-menu";
import { MobileNav } from "@/components/mobile-nav";
import { Container } from "@/components/ui/container";
import { site } from "@/config/site";
import { formatPhoneForDisplay, telHref } from "@/lib/phone";

const PRIMARY = [
  { href: "/sell-your-car", label: "Sell your car" },
  { href: "/finance", label: "Finance" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Public header — a navy band (dark surface) with the dark logo variant, the
 * "Buy cars" disclosure menu, primary links, the phone number when configured
 * and one accent CTA. Sticky, 72 px, with a skip link as the first focusable.
 */
export async function SiteHeader() {
  const [makes, business] = await Promise.all([getMakes(), getBusinessProfile()]);
  const phone = business.phone || null;

  return (
    <header className="dark sticky top-0 z-[var(--z-header)] w-full border-b border-border bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[var(--z-modal)] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-card-foreground"
      >
        Skip to content
      </a>
      <Container className="flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label={`${site.brandName} home`}>
          <BrandLogo variant="dark" height={48} priority />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          <BuyCarsMenu makes={makes} />
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {phone ? (
            <a
              href={telHref(phone)}
              className="hidden h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted md:inline-flex"
            >
              <Phone className="size-4 text-accent-bright" aria-hidden="true" />
              {formatPhoneForDisplay(phone)}
            </a>
          ) : null}
          <Link
            href="/used-cars"
            className="hidden h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover sm:inline-flex"
          >
            Browse cars
          </Link>
          <MobileNav makes={makes} phone={phone} />
        </div>
      </Container>
    </header>
  );
}
