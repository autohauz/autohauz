import { JsonLd } from "@/components/json-ld";
import { getCompanyProfile, getPhoneNumbers } from "@/lib/data/settings";
import { getActiveLocations } from "@/lib/data/locations";
import { autoDealerSchema, organizationSchema, websiteSchema } from "@/lib/seo/jsonld";

/**
 * Site-wide entity graph (SRS §16.4) — three linked nodes:
 *
 *   • Organization  — the brand entity behind the knowledge panel. The site
 *     previously published none at all; the only builder for it lived in the
 *     dead rental-era `seo/schema.ts` and described the wrong business.
 *   • WebSite + SearchAction — makes the site eligible for a Google sitelinks
 *     searchbox, and was likewise never rendered anywhere.
 *   • AutoDealer    — the physical Lansvale storefront, linked to the brand
 *     via `parentOrganization` so the two don't compete as separate entities.
 *
 * All three carry stable `@id`s so per-page nodes (Vehicle offers, breadcrumbs,
 * collection pages) reference them instead of redeclaring detached copies.
 *
 * This lives in a component rather than only in `(public)/layout.tsx` because
 * the homepage (`src/app/page.tsx`) sits OUTSIDE the `(public)` route group —
 * it has its own light-theme shell — so a layout-only graph skipped the single
 * page where the Organization and SearchAction entities matter most.
 *
 * All three data reads are `unstable_cache`d, so rendering this on both the
 * layout and the homepage costs no extra queries.
 */
export async function SiteEntityGraph() {
  const [company, locations, phones] = await Promise.all([
    getCompanyProfile(),
    getActiveLocations(),
    getPhoneNumbers(),
  ]);

  const rating = (company.google_rating as number) ?? null;
  const reviewCount = (company.google_review_count as number) ?? null;
  const email = (company.email as string) ?? null;

  return (
    <JsonLd
      schema={[
        organizationSchema({ phone: phones.whatsapp || phones.primary, email, rating, reviewCount }),
        websiteSchema(),
        autoDealerSchema({
          name: (company.trading_name as string) || "Cars365",
          email,
          phone: phones.primary,
          rating,
          reviewCount,
          location: locations[0] ?? null,
          priceRange: (company.price_range as string) || "$$",
        }),
      ]}
    />
  );
}
