import type { Metadata } from "next";
import { Star } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ListingBreadcrumbs } from "@/components/listing-breadcrumbs";
import { Container, PageHeader } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getApprovedTestimonials } from "@/lib/data/content";
import { getBusinessProfile } from "@/lib/data/business";
import { hasReviews } from "@/config/business";
import { pageMetadata } from "@/lib/seo/metadata";
import type { TestimonialSource } from "@/lib/domain";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const testimonials = await getApprovedTestimonials(1);
  return pageMetadata({
    path: "/testimonials",
    title: "Customer reviews",
    description: "What customers say about buying a car with us, in their own words.",
    // An empty review page is thin content: keep it out of the index until
    // there are genuine reviews to show.
    noindex: testimonials.length === 0,
  });
}

export const revalidate = 3600;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-4", i < rating ? "fill-accent-bright text-accent-bright" : "text-border")} aria-hidden="true" />
      ))}
    </span>
  );
}

const SOURCE_LABELS: Record<TestimonialSource, string> = { google: "Google review", facebook: "Facebook review", direct: "Customer review" };

export default async function TestimonialsPage() {
  const [testimonials, business] = await Promise.all([getApprovedTestimonials(60), getBusinessProfile()]);

  // Only genuine, staff-entered review figures are shown — never a fallback,
  // and no AggregateRating markup (self-serving review schema is ineligible).
  const showRating = hasReviews(business);

  return (
    <>
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container>
          <PageHeader
            above={<ListingBreadcrumbs trail={[["Reviews", "/testimonials"]]} />}
            title="What our customers say"
            description={
              showRating ? (
                <span className="inline-flex flex-wrap items-center gap-x-2">
                  <Star className="size-4 fill-accent-bright text-accent-bright" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{business.googleRating}</span>
                  <span>from {business.googleReviewCount?.toLocaleString("en-AU")} Google reviews</span>
                </span>
              ) : (
                "Real feedback from people who bought a car here."
              )
            }
            className="mb-10"
          />

          {testimonials.length === 0 ? (
            <EmptyState title="No reviews published yet" description="We'll add customer reviews as they come in." action={{ label: "Browse cars", href: "/used-cars" }} />
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <li key={t.id} className="flex">
                  <figure className="flex w-full flex-col rounded-lg border border-border bg-card p-6">
                    <Stars rating={t.rating} />
                    <blockquote className="mt-4 flex-1 leading-relaxed text-body">“{t.quote}”</blockquote>
                    <figcaption className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                      <span className="font-semibold text-foreground">{t.customerName}</span>
                      <span className="text-muted-foreground">
                        {SOURCE_LABELS[t.source]}
                        {t.reviewDate ? `, ${new Date(t.reviewDate).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}` : ""}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-16 rounded-lg border border-border bg-card p-6 text-center sm:p-8">
            <h2 className="text-xl">Ready to find your next car?</h2>
            <p className="mx-auto mt-2 max-w-md text-body">Browse the current stock or get in touch — we reply during business hours.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/used-cars">Browse cars</ButtonLink>
              <ButtonLink href="/contact" variant="outline">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
