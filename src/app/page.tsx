import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, BadgeCheck, Handshake, CircleDollarSign, ArrowRight, Car, CarFront, Navigation, Users, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroSearch } from "@/components/hero-search";
import { NewsletterForm } from "@/components/newsletter-form";
import { FaqList } from "@/components/faq-list";
import { SiteEntityGraph } from "@/components/site-entity-graph";
import { Container, Section } from "@/components/ui/container";
import { getFeaturedVehicles, getMakes } from "@/lib/data/inventory";
import { getApprovedTestimonials, getPublishedFaqs } from "@/lib/data/content";
import { getBusinessProfile } from "@/lib/data/business";
import { pageMetadata } from "@/lib/seo/metadata";
import { site } from "@/config/site";
import { seo, withRegion } from "@/config/seo";
import { hasReviews } from "@/config/business";

import { BrowseBodyTypeSection } from "@/components/home/browse-body-type-section";
import { FeaturedCarsList } from "@/components/home/featured-cars-list";
import { TrustedReviewsSection } from "@/components/home/trusted-reviews-section";
import { HowItWorksSection } from "@/components/home/how-it-works-section";
import { PromoBannersSection } from "@/components/home/promo-banners-section";
import { DifferenceHeroSection } from "@/components/home/difference-hero-section";
import { HelpfulGuidesSection } from "@/components/home/helpful-guides-section";
import { ResponsiveImage } from "@/components/responsive-image";

// `title.absolute` bypasses the root layout's "%s | AutoHauz" template — the
// homepage title already carries the brand.
const HOME_TITLE = `${withRegion("Used Cars for Sale")} | ${site.brandName}`;

export const metadata: Metadata = {
  ...pageMetadata({ path: "/", title: HOME_TITLE, description: seo.defaultDescription }),
  title: { absolute: HOME_TITLE },
};

export const revalidate = 900;

const TRUST = [
  { icon: ShieldCheck, title: "Inspected before it's listed", body: "Every car is checked and its condition documented — including any imperfections." },
  { icon: BadgeCheck, title: "The advertised price is the price", body: "Any on-road costs are explained up front, in writing." },
  { icon: CircleDollarSign, title: "Finance you can compare", body: "Estimate repayments online, then talk to us about the options." },
  { icon: Handshake, title: "Trade-ins welcome", body: "Bring your current car for a fair, no-obligation valuation." },
];

export default async function HomePage() {
  const [featured, makes, testimonials, faqs, business] = await Promise.all([
    getFeaturedVehicles(8),
    getMakes(),
    getApprovedTestimonials(3),
    getPublishedFaqs(),
    getBusinessProfile(),
  ]);
  const showReviews = hasReviews(business) || testimonials.length > 0;
  const homeFaqs = faqs.slice(0, 6);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* The homepage sits outside the (public) route group, so it renders the entity graph itself. */}
      <SiteEntityGraph />
      <SiteHeader />

      <main id="main">
        {/* Hero — Immersive automotive image background with text-safe gradient on the left */}
        <section className="relative overflow-hidden bg-[#040f24] pb-28 pt-16 sm:pb-32 sm:pt-16 lg:pb-32 lg:pt-12">
          <div className="absolute inset-0 z-0">
            <ResponsiveImage src="/images/heroes/homepage-hero.jpg" alt="" fill priority className="object-cover object-right" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#040f24] via-[#040f24]/90 to-transparent sm:via-[#040f24]/70" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#040f24] via-transparent to-transparent opacity-90" />
          </div>
          
          <Container className="relative z-10">
            <div className="max-w-2xl text-white">
              <div className="mb-3 flex items-center gap-2 text-[12px] font-bold tracking-[0.15em] text-[#2B8BF6] uppercase">
                <Navigation className="size-4" aria-hidden="true" />
                <span>QUALITY PRE-OWNED CARS</span>
              </div>
              <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-[56px] lg:leading-[1.1]">
                Find the Right Car <br />
                For <span className="text-[#2B8BF6]">What&apos;s Next</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg font-medium text-white/90 sm:text-lg">
                Carefully selected. Professionally inspected. Ready for Australian roads. Whether you&apos;re buying, selling or upgrading, AutoHauz makes it simple.
              </p>
              
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link 
                  href="/used-cars" 
                  className="inline-flex h-[46px] items-center justify-center gap-2 rounded-md bg-accent px-7 text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
                >
                  Browse cars <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link 
                  href="/sell-your-car" 
                  className="inline-flex h-[46px] items-center justify-center gap-2 rounded-md border border-white/40 bg-transparent px-7 text-[14px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  <Car className="size-[18px]" aria-hidden="true" />
                  Sell your car
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 border-t border-white/20 pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-[10px] border border-[#2B8BF6]/30 bg-transparent text-[#2B8BF6]">
                    <CarFront className="size-5 stroke-[1.5]" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-white">Great Vehicles</span>
                    <span className="text-[12px] text-white/70">Better Journeys</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-[10px] border border-[#2B8BF6]/30 bg-transparent text-[#2B8BF6]">
                    <Users className="size-5 stroke-[1.5]" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-white">Trusted Local Team</span>
                    <span className="text-[12px] text-white/70">Here when you need us</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-[10px] border border-[#2B8BF6]/30 bg-transparent text-[#2B8BF6]">
                    <Wallet className="size-5 stroke-[1.5]" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-white">Flexible Finance</span>
                    <span className="text-[12px] text-white/70">Options for your lifestyle</span>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Search desk visually overlapping the hero */}
        <Container className="relative z-20 -mt-16 sm:-mt-20 lg:-mt-12 flex justify-center">
          <HeroSearch makes={makes} />
        </Container>

        {/* Trust — a list, not a card grid */}
        <Section spacing="tight" aria-labelledby="trust-heading">
          <Container>
            <h2 id="trust-heading" className="sr-only">Why buy with {site.brandName}</h2>
            <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map((t) => (
                <li key={t.title} className="flex gap-3">
                  <t.icon className="mt-0.5 size-6 shrink-0 text-accent-bright" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-semibold">{t.title}</h3>
                    <p className="mt-1 text-sm text-body">{t.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* Featured stock */}
        <Section className="bg-card" aria-labelledby="featured-heading">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="featured-heading" className="speed-line">Featured Cars</h2>
              </div>
              <Link href="/used-cars" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                See all cars <ArrowRight className="size-4" />
              </Link>
            </div>
            <FeaturedCarsList vehicles={featured} />
          </Container>
        </Section>

        {/* Browse by body type (Animated Framer Motion Section matching screenshot) */}
        <BrowseBodyTypeSection />

        {/* Real reviews only: hidden until testimonials or a genuine rating exist. */}
        {showReviews ? <TrustedReviewsSection testimonials={testimonials} business={business} /> : null}

        {/* How it works (Animated Framer Motion Step Sequence matching screenshot) */}
        <HowItWorksSection />

        {/* Dual Promotional Banners (Sell Your Car + Finance Your Next Car matching screenshot) */}
        <PromoBannersSection />

        {/* The AutoHauz Difference (Hero Showcase Banner matching screenshot) */}
        <DifferenceHeroSection />

        {/* Helpful guides (3-Column Articles Grid matching screenshot) */}
        <HelpfulGuidesSection />



        {/* FAQ — same source as /faqs */}
        {homeFaqs.length > 0 ? (
          <Section aria-labelledby="faq-heading">
            <Container width="prose">
              <h2 id="faq-heading" className="speed-line">Common questions</h2>
              <FaqList faqs={homeFaqs} name="home-faq" className="mt-8" />
              <Link href="/faqs" className="mt-6 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
                All questions
              </Link>
            </Container>
          </Section>
        ) : null}

        {/* Newsletter */}
        <Section dark spacing="tight" aria-labelledby="newsletter-heading">
          <Container width="prose" className="text-center">
            <h2 id="newsletter-heading">Hear about new stock first</h2>
            <p className="mt-2 text-body">
              Occasional emails when new cars are listed. We&apos;ll ask you to confirm, and you can unsubscribe any time. See our{" "}
              <Link href="/legal/privacy-policy" className="underline underline-offset-4">privacy policy</Link>.
            </p>
            <div className="mt-6">
              <NewsletterForm />
            </div>
          </Container>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
