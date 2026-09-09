import { siteBaseUrl, absoluteUrl } from "@/lib/seo/site";
import { BODY_TYPE_LABELS, DRIVE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/nav";
import { resolveSocialUrl, SOCIAL_URLS } from "@/lib/social-links";
import type { VehicleDetail, VehicleListItem, Testimonial, Faq, LocationBranch } from "@/lib/domain";

/** JSON-LD builders (SRS §16.4). All return plain objects; render with <JsonLd>. */

const CONTEXT = "https://schema.org";

/**
 * Stable @id anchors for the site-wide entities. Giving the Organization and
 * WebSite fixed IDs lets every other node (Offer seller, ItemList publisher,
 * breadcrumbs) point at the *same* entity instead of re-declaring a detached
 * copy, which is what lets Google resolve one consolidated knowledge graph for
 * the brand rather than several competing ones.
 */
export const ORGANIZATION_ID = `${siteBaseUrl()}/#organization`;
export const WEBSITE_ID = `${siteBaseUrl()}/#website`;
export const LOCAL_BUSINESS_ID = `${siteBaseUrl()}/#localbusiness`;

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  const base = siteBaseUrl();
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${base}${it.path}`,
    })),
  };
}

/**
 * ItemList for an inventory grid.
 *
 * Accepts the vehicles themselves rather than bare paths so each ListItem can
 * carry a name and image. A URL-only list tells Google the page has ten links;
 * a named list with images tells it the page is a product collection, which is
 * what qualifies a listing page for carousel/rich treatment.
 *
 * `startPosition` keeps positions globally correct across pagination — page 2
 * of a 12-per-page grid starts at 13, not 1.
 */
export function itemListSchema(
  items: Pick<VehicleListItem, "makeSlug" | "modelSlug" | "slug" | "year" | "makeName" | "modelName" | "variant" | "price" | "coverImageUrl">[],
  opts: { startPosition?: number; total?: number } = {},
) {
  const start = opts.startPosition ?? 1;
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    ...(opts.total != null ? { numberOfItems: opts.total } : {}),
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: items.map((v, i) => ({
      "@type": "ListItem",
      position: start + i,
      url: absoluteUrl(`/used-cars/${v.makeSlug}/${v.modelSlug}/${v.slug}`),
      name: `${v.year} ${v.makeName} ${v.modelName}${v.variant ? ` ${v.variant}` : ""}`,
      ...(v.coverImageUrl ? { image: v.coverImageUrl } : {}),
    })),
  };
}

/**
 * CollectionPage wrapper for landing/listing routes. Declares the page as a
 * curated collection belonging to the site, which is the correct type for a
 * faceted hub (the bare ItemList alone leaves the page itself untyped).
 */
export function collectionPageSchema(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": CONTEXT,
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(input.path)}#collection`,
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": ORGANIZATION_ID },
    inLanguage: "en-AU",
  };
}

/**
 * WebSite entity + sitelinks SearchAction.
 *
 * This was previously defined in the rental-era `seo/schema.ts` and never
 * rendered anywhere, so the site published no WebSite node at all. The old
 * SearchAction also pointed at `/search?city=`, a parameter the used-car search
 * does not accept; it now targets the real inventory query parameter.
 */
export function websiteSchema() {
  const base = siteBaseUrl();
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: base,
    name: "Cars365",
    description:
      "Quality used cars for sale in Australia — inspected, honestly priced, with finance and trade-ins available.",
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-AU",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${base}/used-cars?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Brand Organization entity powering the knowledge panel.
 *
 * Replaces the dead rental-era builder, whose description advertised "verified
 * car rental operators" — the wrong business entirely for a used-car dealership
 * and actively misleading to an entity-matching crawler.
 */
export function organizationSchema(input: {
  phone?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}) {
  const base = siteBaseUrl();
  // resolveSocialUrl treats empty/whitespace/"#" env values as unset so a
  // placeholder can't shadow (or drop) the real brand profile URL.
  const sameAs = [
    resolveSocialUrl(process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL, SOCIAL_URLS.facebook),
    resolveSocialUrl(process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL, SOCIAL_URLS.linkedin),
    resolveSocialUrl(process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL, SOCIAL_URLS.instagram),
    resolveSocialUrl(process.env.NEXT_PUBLIC_SOCIAL_X_URL),
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Cars365",
    legalName: "Cars 365",
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/icons/icon-512.png`,
      width: 512,
      height: 512,
    },
    image: `${base}/og-image.jpg`,
    description:
      "Cars365 sells quality, inspected used cars in Lansvale, NSW — transparent pricing, finance and trade-ins, serving buyers across Sydney and Australia.",
    areaServed: { "@type": "Country", name: "Australia" },
    ...(input.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: input.phone,
            contactType: "sales",
            areaServed: "AU",
            availableLanguage: ["en-AU"],
          },
        }
      : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.rating && input.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.rating,
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function faqPageSchema(faqs: Pick<Faq, "question" | "answer">[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * Vehicle detail page schema — the highest-value markup on the site.
 *
 * Emits the full set of properties Google's vehicle-listing documentation reads
 * plus the Offer fields required for a price-bearing rich result. Every field is
 * conditional on real data: partial markup outranks invented markup, and a
 * fabricated value is a manual-action risk.
 *
 * Notable additions over the original minimal version:
 *  • `@id` + `mainEntityOfPage` anchor the vehicle to its canonical URL.
 *  • ALL gallery images (Google prefers multiple; single-image markup is
 *    ineligible for some image treatments) instead of just the cover.
 *  • `sku`/`vehicleIdentificationNumber` — the dealer's stock ID and masked VIN
 *    are the entity keys that let Google dedupe this car across aggregators.
 *  • `priceValidUntil`, without which Google reports "missing field price".
 *  • `driveWheelConfiguration`, `numberOfDoors`, `vehicleEngine`, `vehicleConfiguration`.
 *  • The Offer's `seller` and `availableAtOrFrom` reference the site-wide
 *    AutoDealer node by `@id`, so the dealership's Google review aggregate
 *    (which is what surfaces stars beside a vehicle result) resolves from one
 *    entity rather than a detached copy per vehicle.
 */
export function vehicleSchema(
  v: VehicleDetail,
  opts: {
    path: string;
    /**
     * How long the advertised price stands (YYYY-MM-DD). Defaults to 30 days
     * out, which matches how often stock is repriced here. Google reports
     * "missing field priceValidUntil" without it and suppresses the price from
     * the rich result. Injectable so tests can pin the date; the default is
     * computed here rather than by the caller because reading the clock inside
     * a Server Component's render violates React's purity rule.
     */
    priceValidUntil?: string;
  },
) {
  const priceValidUntil =
    opts.priceValidUntil ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const url = absoluteUrl(opts.path);
  const availability =
    v.status === "sold" ? "https://schema.org/SoldOut"
    : v.status === "reserved" ? "https://schema.org/LimitedAvailability"
    : "https://schema.org/InStock";

  const name = `${v.year} ${v.makeName} ${v.modelName}${v.variant ? ` ${v.variant}` : ""}`;
  const images = v.images.map((img) => img.url).filter(Boolean);

  return {
    "@context": CONTEXT,
    "@type": "Vehicle",
    "@id": `${url}#vehicle`,
    name,
    ...(v.description ? { description: v.description } : {}),
    url,
    mainEntityOfPage: url,
    brand: { "@type": "Brand", name: v.makeName },
    model: v.modelName,
    ...(v.variant ? { vehicleConfiguration: v.variant } : {}),
    vehicleModelDate: String(v.year),
    productionDate: String(v.year),
    bodyType: BODY_TYPE_LABELS[v.bodyType],
    fuelType: FUEL_LABELS[v.fuelType],
    vehicleTransmission: TRANSMISSION_LABELS[v.transmission],
    itemCondition: "https://schema.org/UsedCondition",
    ...(v.stockId ? { sku: v.stockId, mpn: v.stockId } : {}),
    ...(v.vinMasked ? { vehicleIdentificationNumber: v.vinMasked } : {}),
    ...(v.exteriorColor ? { color: v.exteriorColor } : {}),
    ...(v.interior ? { vehicleInteriorColor: v.interior } : {}),
    ...(v.seats ? { seatingCapacity: v.seats } : {}),
    ...(v.doors ? { numberOfDoors: v.doors } : {}),
    ...(v.driveType ? { driveWheelConfiguration: DRIVE_LABELS[v.driveType] } : {}),
    ...(v.engine || v.powerKw
      ? {
          vehicleEngine: {
            "@type": "EngineSpecification",
            ...(v.engine ? { name: v.engine } : {}),
            ...(v.powerKw
              ? { enginePower: { "@type": "QuantitativeValue", value: v.powerKw, unitCode: "KWT" } }
              : {}),
          },
        }
      : {}),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" },
    ...(images.length > 0
      ? {
          image: images.map((src) => ({
            "@type": "ImageObject",
            url: src,
            contentUrl: src,
            caption: name,
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      price: v.price,
      priceCurrency: "AUD",
      priceValidUntil,
      availability,
      itemCondition: "https://schema.org/UsedCondition",
      url,
      availableAtOrFrom: { "@id": LOCAL_BUSINESS_ID },
      areaServed: { "@type": "Country", name: "Australia" },
      // A pure `@id` reference to the AutoDealer node the site-wide entity
      // graph already publishes — which carries the dealership's name, address
      // and Google review aggregate. Redeclaring an inline `"@type":
      // "AutoDealer"` under the Organization's `@id` (as this did) asserts one
      // identifier is two different types, which parsers resolve unpredictably.
      seller: { "@id": LOCAL_BUSINESS_ID },
    },
  };
}

/** Maps a `LocationBranch.hours` record to schema.org openingHours strings. */
const DAY_ABBREV: Record<string, string> = {
  monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
  friday: "Fr", saturday: "Sa", sunday: "Su",
};

function openingHours(hours: Record<string, string> | null | undefined): string[] {
  if (!hours) return [];
  return Object.entries(hours)
    .map(([day, range]) => {
      const abbrev = DAY_ABBREV[day.trim().toLowerCase()];
      // Skip unknown day keys and "Closed"/empty values — an unparseable
      // openingHours string invalidates the whole LocalBusiness node.
      if (!abbrev || !range || !/\d/.test(range)) return null;
      return `${abbrev} ${range.replace(/\s*[–—]\s*/g, "-").replace(/\s+/g, "")}`;
    })
    .filter((s): s is string => s !== null);
}

/**
 * The physical dealership (LocalBusiness). Distinct from the brand
 * `organizationSchema` and linked to it via `parentOrganization`, so Google
 * resolves one brand with one storefront rather than two rival organisations.
 * This is what competes in the Australian local pack for "used car dealer near me".
 */
export function autoDealerSchema(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  location?: LocationBranch | null;
  /** Advertised inventory price band, e.g. "$$" or "$5,000-$60,000". */
  priceRange?: string | null;
}) {
  const base = siteBaseUrl();
  const loc = input.location;
  const hours = openingHours(loc?.hours);
  return {
    "@context": CONTEXT,
    "@type": "AutoDealer",
    "@id": LOCAL_BUSINESS_ID,
    name: input.name,
    url: base,
    image: `${base}/og-image.jpg`,
    logo: `${base}/icons/icon-512.png`,
    parentOrganization: { "@id": ORGANIZATION_ID },
    currenciesAccepted: "AUD",
    ...(input.priceRange ? { priceRange: input.priceRange } : {}),
    ...(hours.length > 0 ? { openingHours: hours } : {}),
    areaServed: { "@type": "Country", name: "Australia" },
    ...(input.email ? { email: input.email } : {}),
    ...(loc?.phone || input.phone ? { telephone: loc?.phone ?? input.phone } : {}),
    ...(loc
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: loc.address,
            addressLocality: loc.city,
            addressRegion: loc.state,
            postalCode: loc.postcode ?? undefined,
            addressCountry: "AU",
          },
          ...(loc.lat && loc.lng ? { geo: { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng } } : {}),
        }
      : {
          address: {
            "@type": "PostalAddress",
            streetAddress: "16 Hollywood Dr",
            addressLocality: "Lansvale",
            addressRegion: "NSW",
            postalCode: "2166",
            addressCountry: "AU",
          }
        }),
    ...(input.rating && input.reviewCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: input.rating, reviewCount: input.reviewCount } }
      : {}),
  };
}

export function reviewsAggregateSchema(testimonials: Testimonial[]) {
  if (testimonials.length === 0) return null;
  const avg = testimonials.reduce((a, t) => a + t.rating, 0) / testimonials.length;
  return {
    "@context": CONTEXT,
    "@type": "Product",
    name: "Cars365 used cars",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: Math.round(avg * 10) / 10,
      reviewCount: testimonials.length,
    },
    review: testimonials.slice(0, 10).map((t) => ({
      "@type": "Review",
      author: { "@type": "Person", name: t.customerName },
      reviewRating: { "@type": "Rating", ratingValue: t.rating, bestRating: 5 },
      reviewBody: t.quote,
      ...(t.reviewDate ? { datePublished: t.reviewDate } : {}),
    })),
  };
}

export function articleSchema(input: { title: string; path: string; publishedAt?: string | null; image?: string | null; author?: string | null }) {
  const base = siteBaseUrl();
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: input.title,
    mainEntityOfPage: `${base}${input.path}`,
    ...(input.image ? { image: input.image } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    ...(input.author ? { author: { "@type": "Person", name: input.author } } : {}),
    publisher: { "@type": "Organization", name: "Cars365" },
  };
}
