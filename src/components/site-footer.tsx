import Link from "next/link";
import { Phone, Mail, MapPin, Star, Clock } from "lucide-react";
import { getMakes } from "@/lib/data/inventory";
import { getPhoneNumbers, getCompanyProfile } from "@/lib/data/settings";
import { getActiveLocations } from "@/lib/data/locations";
import { NewsletterForm } from "@/components/newsletter-form";
import {
  NAV_BODY_TYPES,
  BODY_TYPE_LABELS,
  bodyTypeHref,
  makeHref,
} from "@/lib/nav";

const COMPANY_LINKS = [
  { href: "/about",          label: "About Us" },
  { href: "/how-it-works",   label: "How It Works" },
  { href: "/sell-your-car",  label: "Sell Your Car" },
  { href: "/finance",        label: "Finance" },
  { href: "/testimonials",   label: "Testimonials" },
  { href: "/faqs",           label: "FAQs" },
  { href: "/contact",        label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy-policy", label: "Privacy Policy" },
  { href: "/legal/terms",          label: "Terms & Conditions" },
  { href: "/legal/disclaimer",     label: "Disclaimer" },
];

const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const DAYS_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function SiteFooter() {
  const [makes, phones, company, locations] = await Promise.all([
    getMakes(),
    getPhoneNumbers(),
    getCompanyProfile(),
    getActiveLocations(),
  ]);

  const popularMakes     = makes.filter((m) => m.isPopular).slice(0, 8);
  const phone            = phones.primary || null;
  const email            = (company.email as string) || null;
  const rating           = company.google_rating as number | undefined;
  const reviewCount      = company.google_review_count as number | undefined;
  const tradingName      = (company.trading_name as string) || "Cars365";
  const branch           = locations[0] ?? null;
  const currentYear      = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#0a0a0f] text-slate-400">
      {/* Subtle top gradient accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent" />



      {/* ── Main link columns ──────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">

          {/* Brand column – spans 2 on xl */}
          <div className="col-span-2 xl:col-span-2">
            <Link href="/" className="inline-block" aria-label="Cars365 home">
              <img
                src="/LOGO.png"
                alt="Cars365 Australia"
                className="h-10 w-auto object-contain brightness-110"
              />
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Quality used cars honestly inspected, fairly priced, and backed by a
              team that actually picks up the phone.
            </p>

            {/* Google rating pill */}
            {rating ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-white">{rating}</span>
                {reviewCount ? (
                  <span className="text-slate-400 text-xs">
                    ({reviewCount.toLocaleString()} reviews)
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Contact details */}
            <ul className="mt-5 space-y-2.5 text-sm">
              {phone ? (
                <li>
                  <a
                    href={`tel:${phone}`}
                    className="group flex items-center gap-2.5 transition-colors hover:text-white"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 group-hover:bg-yellow-400/10 transition-colors">
                      <Phone className="size-3.5 text-yellow-400" />
                    </span>
                    <span>{phone}</span>
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="group flex items-center gap-2.5 transition-colors hover:text-white"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 group-hover:bg-yellow-400/10 transition-colors">
                      <Mail className="size-3.5 text-yellow-400" />
                    </span>
                    <span className="break-all">{email}</span>
                  </a>
                </li>
              ) : null}
              <li>
                <a
                  href="https://maps.google.com/maps?q=16+Hollywood+Dr,+Lansvale+NSW+2166,+Australia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 transition-colors hover:text-white"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 group-hover:bg-yellow-400/10 transition-colors">
                    <MapPin className="size-3.5 text-yellow-400" />
                  </span>
                  <span>16 Hollywood Dr, Lansvale NSW 2166</span>
                </a>
              </li>
            </ul>

            {/* Embedded map */}
            <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
              <iframe
                title="Cars 365 Location"
                src="https://maps.google.com/maps?q=16%20Hollywood%20Dr,%20Lansvale%20NSW%202166,%20Australia&t=&z=14&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="150"
                style={{ border: 0, display: "block", filter: "grayscale(30%) brightness(0.8) contrast(1.1)" }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>

          {/* Browse by Make */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Browse by make
            </h3>
            <ul className="space-y-2.5 text-sm">
              {popularMakes.map((m) => (
                <li key={m.slug}>
                  <Link
                    href={makeHref(m.slug)}
                    className="transition-colors hover:text-white"
                  >
                    {m.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/used-cars"
                  className="font-semibold text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  All makes →
                </Link>
              </li>
            </ul>
          </div>

          {/* By body type */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Body type
            </h3>
            <ul className="space-y-2.5 text-sm">
              {NAV_BODY_TYPES.slice(0, 7).map((b) => (
                <li key={b}>
                  <Link
                    href={bodyTypeHref(b)}
                    className="transition-colors hover:text-white"
                  >
                    {BODY_TYPE_LABELS[b]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>


          {/* Company */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Company
            </h3>
            <ul className="space-y-2.5 text-sm">
              {COMPANY_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Opening Hours */}
          {branch && Object.keys(branch.hours).length > 0 ? (
            <div>
              <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/50">
                <Clock className="size-3.5" />
                Hours
              </h3>
              <ul className="space-y-1.5 text-sm">
                {DAYS_ORDER.filter((d) => branch.hours[d]).map((d) => (
                  <li key={d} className="grid grid-cols-[40px_1fr] gap-6">
                    <span className="text-slate-500">{DAY_LABELS[d]}</span>
                    <span className={`whitespace-nowrap ${branch.hours[d] === "closed" ? "text-slate-600" : "text-white"}`}>
                      {branch.hours[d] === "closed" ? "Closed" : branch.hours[d]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-7 sm:px-6 lg:px-8">

          {/* Social icons — centred row */}
          <div className="flex items-center justify-center gap-3">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/marketplace/profile/1703029730/?tab=listings"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition-all hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-400"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            {/* Instagram */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition-all hover:border-pink-500/50 hover:bg-pink-500/10 hover:text-pink-400"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
              </svg>
            </a>
            {/* YouTube */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z" clipRule="evenodd" />
              </svg>
            </a>
            {/* X / Twitter */}
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>

          {/* Copyright + legal — centred row below socials */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-600">
            <span>© {currentYear} {tradingName}. All rights reserved.</span>
            {LEGAL_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-slate-300"
              >
                {l.label}
              </Link>
            ))}
            <span>
              Website by{" "}
              <a
                href="https://www.tradiedigitalagency.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-300"
              >
                Tradie Digital Agency
              </a>
            </span>
          </div>

        </div>
      </div>
    </footer>
  );
}
