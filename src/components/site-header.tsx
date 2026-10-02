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
 * Premium public header.
 */
export async function SiteHeader() {
  const [makes, business] = await Promise.all([getMakes(), getBusinessProfile()]);
  const phone = business.phone || null;

  return (
    <header className="dark sticky top-0 z-[var(--z-header)] w-full border-b border-border bg-background/95 backdrop-blur-md text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[var(--z-modal)] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-card-foreground"
      >
        Skip to content
      </a>
      <Container className="flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link href="/" className="flex shrink-0 items-center transition-opacity hover:opacity-90" aria-label={`${site.brandName} home`}>
          <BrandLogo variant="dark" height={48} priority />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1.5 lg:flex">
          <BuyCarsMenu makes={makes} />
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold tracking-wide text-foreground transition-all hover:bg-white/10"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          {phone ? (
            <a
              href={telHref(phone)}
              className="hidden h-10 items-center gap-2 rounded-full px-4 text-sm font-bold tracking-wide text-foreground transition-all hover:bg-white/10 md:inline-flex"
            >
              <Phone className="size-4 text-accent-bright" aria-hidden="true" />
              {formatPhoneForDisplay(phone)}
            </a>
          ) : null}
          <Link
            href="/used-cars"
            className="hidden h-10 items-center rounded-full bg-accent px-6 text-sm font-bold tracking-wide text-white shadow-md shadow-accent/20 transition-all hover:scale-105 hover:bg-accent/90 hover:shadow-lg hover:shadow-accent/30 sm:inline-flex"
          >
            Browse Inventory
          </Link>
          <MobileNav makes={makes} phone={phone} />
        </div>
      </Container>
    </header>
  );
}
