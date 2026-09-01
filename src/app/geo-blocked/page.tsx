import type { Metadata } from "next";
import { Globe2, Mail, MessageCircle } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { optionalEnv } from "@/lib/config";
import { DEFAULT_ALLOWED_COUNTRIES } from "@/lib/security/geo-restriction";
import { cn } from "@/lib/utils";

/**
 * Geo-restriction landing page.
 *
 * `src/proxy.ts` REWRITES (not redirects) requests from outside the served
 * regions here, so the visitor keeps the URL they asked for and there is no
 * extra round-trip. The page fetches no data, so rendering it is a pure React
 * render — a blocked request never touches Supabase.
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

/** Fallback matches the support address used by src/lib/email/ses.ts. */
const CONTACT_EMAIL = optionalEnv("CONTACT_EMAIL_TO") ?? "support@cars-365.com.au";

/** Same number the site-wide WhatsApp float and dealer JSON-LD advertise. */
const WHATSAPP_NUMBER = "61451344477";

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
    "Cars365 is currently available only in Australia. Get in touch or join the waitlist to hear when we open in your country.",
  robots: {
    index: true,
    follow: true,
    nocache: true,
  },
  // Clears the root layout's `canonical: "/"` — this page must never claim to
  // be the canonical version of the homepage.
  alternates: {},
};

export default function GeoBlockedPage() {
  const regions = servedRegions();
  const waitlistSubject = encodeURIComponent("Cars365 waitlist — open in my country");
  const waitlistBody = encodeURIComponent(
    "Hi Cars365 team,\n\nI'd like to be notified when you start serving my country.\n\nName:\nCountry:\n",
  );

  return (
    <main className="dark bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <BrandLogo priority className="h-[48px] w-[180px] sm:h-[56px] sm:w-[220px]" />

      <div
        className="mt-10 flex size-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10"
        aria-hidden="true"
      >
        <Globe2 className="size-8 text-yellow-400" />
      </div>

      <h1 className="mt-8 max-w-2xl text-2xl font-bold tracking-tight text-balance sm:text-3xl">
        This marketplace is currently available only in {regions}.
      </h1>

      <p className="mt-4 max-w-lg text-base text-muted-foreground">
        Our inventory, pricing and finance offers are built for buyers in {regions},
        so we&apos;ve limited access to those markets for now. If you believe
        you&apos;re seeing this by mistake — for example while using a VPN — turn it
        off and reload the page.
      </p>

      {/* Contact + waitlist. Both are mailto/WhatsApp links by design: the API
          surface stays fully closed to blocked regions, so there is nothing here
          for an out-of-region client to submit against. */}
      <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${waitlistSubject}&body=${waitlistBody}`}
          className={cn(buttonVariants({ variant: "default", size: "cta" }), "gap-2")}
        >
          <Mail className="size-4" />
          Join the waitlist
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "cta" }), "gap-2")}
        >
          <MessageCircle className="size-4" />
          Chat on WhatsApp
        </a>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Questions?{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-medium text-yellow-400 underline-offset-4 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>

      <p className="mt-12 text-xs text-muted-foreground">
        Cars365 — quality used cars, honestly inspected.
      </p>
    </main>
  );
}
