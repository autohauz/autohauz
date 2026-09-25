import Link from "next/link";
import { Phone, Mail, MapPin, Clock, ArrowRight, ExternalLink } from "lucide-react";
import { getMakes } from "@/lib/data/inventory";
import { getBusinessProfile } from "@/lib/data/business";
import { getBlogArticles } from "@/lib/data/blog";
import { BrandLogo } from "@/components/brand-logo";
import { Container } from "@/components/ui/container";
import { NAV_BODY_TYPES, BODY_TYPE_LABELS, bodyTypeHref, makeHref } from "@/lib/nav";
import { socialProfiles, type SocialNetwork } from "@/lib/social-links";
import { site } from "@/config/site";
import { formatAddress, hasAddress } from "@/config/business";
import { formatPhoneForDisplay, telHref } from "@/lib/phone";

const COMPANY_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/sell-your-car", label: "Sell your car" },
  { href: "/finance", label: "Finance" },
  { href: "/testimonials", label: "Testimonials" },
  { href: "/faqs", label: "FAQs" },
  { href: "/contact", label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy-policy", label: "Privacy policy" },
  { href: "/legal/terms", label: "Terms & conditions" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
];

const DAYS = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
] as const;

const SocialIcon = ({ network, className }: { network: SocialNetwork; className?: string }) => {
  switch (network) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.46 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 15.66a6.33 6.33 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    default:
      return null;
  }
};

export async function SiteFooter() {
  const [makes, business, articles] = await Promise.all([
    getMakes(),
    getBusinessProfile(),
    getBlogArticles({ status: "published", limit: 1 }),
  ]);
  // Link the blog only once it has something to read.
  const companyLinks = articles.length > 0 ? [...COMPANY_LINKS, { href: "/blog", label: "Blog" }] : COMPANY_LINKS;
  const popularMakes = makes.filter((m) => m.isPopular).slice(0, 8);
  const name = business.tradingName || site.brandName;
  const address = formatAddress(business.address);
  // A search link rather than an embedded map: the Maps iframe pulled ~1 MB of
  // third-party script into every public page. /contact keeps the live map.
  const directionsUrl = hasAddress(business.address)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  const hours = DAYS.filter(([key]) => business.hours[key]);
  const socials = socialProfiles(business.social);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#040f24] text-white">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[280px_1fr_320px] lg:gap-16">
          {/* Left Column */}
          <div className="flex flex-col">
            <Link href="/" className="inline-block" aria-label={`${site.brandName} home`}>
              <BrandLogo variant="dark" height={36} />
            </Link>
            <p className="mt-6 text-[13px] leading-[1.6] text-white/70">
              Quality used cars, inspected before listing and priced transparently. Enquire online, arrange an inspection or talk to us about finance and trade-ins.
            </p>
            {/* Contact details come only from the business profile (Admin → Settings). */}
            {business.phone || business.email ? (
              <ul className="mt-6 flex flex-col gap-4">
                {business.phone ? (
                  <li>
                    <a href={telHref(business.phone)} className="flex items-center gap-3 text-[14px] text-white hover:text-white/80 transition-colors">
                      <Phone className="size-4 text-[#2B8BF6]" aria-hidden="true" />
                      {formatPhoneForDisplay(business.phone)}
                    </a>
                  </li>
                ) : null}
                {business.email ? (
                  <li>
                    <a href={`mailto:${business.email}`} className="flex items-center gap-3 text-[14px] text-white hover:text-white/80 transition-colors">
                      <Mail className="size-4 text-[#2B8BF6]" aria-hidden="true" />
                      {business.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
            {hours.length > 0 ? (
              <>
                <hr className="my-6 border-white/10" />
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-[18px] text-[#2B8BF6] shrink-0" aria-hidden="true" />
                  <dl className="grid grid-cols-[48px_1fr] gap-y-1.5 text-[13px]" aria-label="Opening hours">
                    {hours.map(([key, label]) => (
                      <div key={key} className="contents">
                        <dt className="text-white/70">{label}</dt>
                        <dd className="text-white">{business.hours[key]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            ) : null}

            {socials.length > 0 ? (
              <>
                <hr className="my-6 border-white/10" />
                <div>
                  <h2 className="mb-4 text-[14px] font-bold text-white">Follow us</h2>
                  <ul className="flex flex-wrap gap-3">
                    {socials.map((s) => (
                      <li key={s.network}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex size-[38px] items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-[#2B8BF6]">
                          <span className="sr-only">{name} on {s.network}</span>
                          <SocialIcon network={s.network} className="size-[18px]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>

          {/* Middle Column */}
          <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {/* Browse by make */}
              <div>
                <h2 className="mb-5 text-[15px] font-bold text-white">Browse by make</h2>
                <ul className="flex flex-col gap-3.5">
                  {popularMakes.map((m) => (
                    <li key={m.slug}><Link href={makeHref(m.slug)} className="text-[14px] text-white/70 hover:text-white transition-colors">{m.name}</Link></li>
                  ))}
                  <li className="pt-1">
                    <Link href="/used-cars" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#2B8BF6] hover:text-[#2B8BF6]/80 transition-colors">
                      All cars <ArrowRight className="size-4" />
                    </Link>
                  </li>
                </ul>
              </div>
              {/* Body type */}
              <div>
                <h2 className="mb-5 text-[15px] font-bold text-white">Body type</h2>
                <ul className="flex flex-col gap-3.5">
                  {NAV_BODY_TYPES.map((b) => (
                    <li key={b}><Link href={bodyTypeHref(b)} className="text-[14px] text-white/70 hover:text-white transition-colors">{BODY_TYPE_LABELS[b]}</Link></li>
                  ))}
                </ul>
              </div>
              {/* Company */}
              <div>
                <h2 className="mb-5 text-[15px] font-bold text-white">Company</h2>
                <ul className="flex flex-col gap-3.5">
                  {companyLinks.map((l) => (
                    <li key={l.href}><Link href={l.href} className="text-[14px] text-white/70 hover:text-white transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column */}
          {address ? (
            <div className="flex flex-col lg:border-l lg:border-white/10 lg:pl-12 lg:ml-[-1rem]">
              <h2 className="mb-5 text-[15px] font-bold text-white">Our location</h2>
              <address className="flex items-start gap-3 rounded-lg bg-white/5 p-6 text-[14px] not-italic leading-relaxed text-white">
                <MapPin className="mt-0.5 size-5 shrink-0 text-[#2B8BF6]" aria-hidden="true" />
                <span>
                  {business.address.street}
                  <br />
                  {`${business.address.suburb} ${business.address.state} ${business.address.postcode}`.trim()}
                </span>
              </address>
              {directionsUrl ? (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-[46px] w-fit items-center justify-center gap-2 rounded-md border border-white/20 px-5 text-[14px] font-medium text-white transition-colors hover:bg-white/10">
                  <MapPin className="size-4" aria-hidden="true" />
                  Get directions <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">(opens Google Maps in a new tab)</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-[13px] text-white/70 lg:flex-row lg:gap-6">
          <p>
            © {year} {business.legalName || name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((l, idx) => (
              <li key={l.href} className="flex items-center gap-4">
                <Link href={l.href} className="transition-colors hover:text-white">{l.label}</Link>
                {idx < LEGAL_LINKS.length - 1 && <span className="text-white/20">|</span>}
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-1">
            Website by <a href="https://www.tradiedigitalagency.com/" target="_blank" rel="noopener noreferrer" className="text-[#f15a24] font-medium border-b border-[#f15a24]/50 hover:border-[#f15a24] transition-colors pb-0.5">Tradie Digital Agency</a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
