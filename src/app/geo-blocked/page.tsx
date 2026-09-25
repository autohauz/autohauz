import type { Metadata } from "next";
import { Globe2, Mail, MessageCircle } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { optionalEnv } from "@/lib/config";
import { getBusinessProfile } from "@/lib/data/business";
import { DEFAULT_ALLOWED_COUNTRIES } from "@/lib/security/geo-restriction";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

/**
 * Geo-restriction landing page.
 *
 * `src/proxy.ts` REWRITES (not redirects) requests from outside the served
 * regions here, so the visitor keeps the URL they asked for and there is no
 * extra round-trip. The only data read is the cached business profile
 * (contact channels); nothing here is submittable from a blocked region.
 *
 * SEO: explicitly `noindex, nofollow`. The proxy also sets `X-Robots-Tag` and
 * `Cache-Control: no-store` on the blocked response, and `robots.ts` disallows
 * `/geo-blocked`, so this page can never displace a real page in the index for
 * the target market.
 */

/**
 * A geo-blocked reply is served under the URL the visitor originally requested
 * (e.g. `/used-cars`). Forcing it dynamic makes Next emit `no-store` itself, so
 * a shared cache can never store this country-specific response against a
 * normal page's cache key and later serve it to an Australian buyer. The page
 * does no I/O, so "dynamic" here costs only a render.
 */
export const dynamic = "force-dynamic";

/** ISO codes → display names, so page copy and policy can never drift apart. */
const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia",
  IN: "India",
};

function servedRegions(): string {
  const names = DEFAULT_ALLOWED_COUNTRIES.map((code) => COUNTRY_NAMES[code] ?? code);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
    : names[0];
}

export const metadata: Metadata = {
  title: "Not available in your region",
  description:
    `${site.brandName} is currently available only in Australia. Get in touch if you have a question about a vehicle.`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  // Clears the root layout's `canonical: "/"` — this page must never claim to
  // be the canonical version of the homepage.
  alternates: {},
};

export default async function GeoBlockedPage() {
  // Contact details come from settings/env only — an unset value hides its
  // button rather than falling back to someone else's number or inbox.
  const business = await getBusinessProfile();
  const contactEmail = business.email || optionalEnv("CONTACT_EMAIL_TO") || null;
  const whatsappNumber = business.whatsapp || null;

  const regions = servedRegions();
  const contactSubject = encodeURIComponent("Enquiry from outside Australia");
  const contactBody = encodeURIComponent(
    `Hi ${site.brandName} team,\n\nI'm outside Australia and have a question.\n\nName:\nCountry:\nQuestion:\n`,
  );

  return (
    <main id="main" className="dark flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 text-center text-foreground">
      <BrandLogo variant="dark" height={52} priority />

      <div className="mt-10 flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-soft-foreground" aria-hidden="true">
        <Globe2 className="size-8" />
      </div>

      <h1 className="mt-8 max-w-2xl text-balance text-2xl sm:text-3xl">
        {site.brandName} is currently available only in {regions}.
      </h1>

      <p className="mt-4 max-w-lg text-base text-muted-foreground">
        Our inventory, pricing and finance offers are built for buyers in {regions},
        so we&apos;ve limited access to those markets for now. If you believe
        you&apos;re seeing this by mistake — for example while using a VPN — turn it
        off and reload the page.
      </p>

      {/* Contact options are mailto/WhatsApp links by design: the API surface
          stays fully closed to blocked regions, so there is nothing here for an
          out-of-region client to submit against. */}
      {contactEmail || whatsappNumber ? (
        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=${contactSubject}&body=${contactBody}`}
              className={cn(buttonVariants({ variant: "default", size: "cta" }))}
            >
              <Mail aria-hidden="true" />
              Email us
            </a>
          ) : null}
          {whatsappNumber ? (
            <a
              href={buildWhatsAppUrl(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "cta" }))}
            >
              <MessageCircle aria-hidden="true" />
              Chat on WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      {contactEmail ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Questions?{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            {contactEmail}
          </a>
        </p>
      ) : null}

      <p className="mt-12 text-xs text-muted-foreground">
        {site.brandName} — {site.tagline.toLowerCase()}.
      </p>
    </main>
  );
}
