import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import type { Testimonial } from "@/lib/domain";
import { hasReviews, type BusinessProfile } from "@/config/business";

/**
 * Customer reviews — real data only.
 *
 * Renders approved testimonials from the database and, separately, the
 * rating summary the business has entered in Settings. Nothing is ever
 * invented: with no testimonials and no configured rating the section is not
 * rendered at all. (Fabricated reviews or ratings are misleading conduct under
 * the Australian Consumer Law.)
 */
export function TrustedReviewsSection({
  testimonials,
  business,
}: {
  testimonials: Testimonial[];
  business: BusinessProfile;
}) {
  const showRating = hasReviews(business);
  if (!showRating && testimonials.length === 0) return null;

  return (
    <section aria-labelledby="reviews-heading" className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="reviews-heading" className="mb-8 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:mb-12">
          What our customers say
        </h2>

        <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-12">
          {showRating ? (
            <div className="flex w-full shrink-0 flex-col lg:w-[220px]">
              <p className="text-6xl font-extrabold leading-none tracking-tight text-foreground">
                {business.googleRating}
                <span className="text-4xl">/5</span>
              </p>
              <Stars rating={business.googleRating ?? 0} className="mt-3 size-7" />
              <p className="mt-4 text-sm text-muted-foreground">
                Google rating from <strong className="font-semibold text-foreground">{business.googleReviewCount}</strong> reviews
              </p>
            </div>
          ) : null}

          {testimonials.length > 0 ? (
            <ul className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((review) => (
                <li key={review.id} className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-card">
                  <figure className="flex h-full flex-col">
                    <Stars rating={review.rating} className="mb-4 size-[18px]" />
                    <blockquote className="mb-6 flex-grow text-sm leading-relaxed text-foreground/80">
                      <p>&ldquo;{review.quote}&rdquo;</p>
                    </blockquote>
                    <figcaption className="mt-auto flex flex-col text-sm">
                      <span className="font-bold text-foreground">{review.customerName}</span>
                      {review.reviewDate ? (
                        <time dateTime={review.reviewDate} className="mt-0.5 text-muted-foreground">
                          {new Date(review.reviewDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                        </time>
                      ) : null}
                      {review.source === "google" ? <span className="mt-0.5 text-muted-foreground">Google review</span> : null}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {testimonials.length > 0 ? (
          <div className="mt-10 flex justify-center">
            <Link href="/testimonials" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
              Read more reviews <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stars({ rating, className }: { rating: number; className: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="flex gap-1">
      <span className="sr-only">Rated {rating} out of 5</span>
      {Array.from({ length: filled }, (_, i) => (
        <Star key={i} aria-hidden="true" className={`${className} fill-warning text-warning`} />
      ))}
    </div>
  );
}
