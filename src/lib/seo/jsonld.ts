import { siteBaseUrl, absoluteUrl } from "@/lib/seo/site";
import { BODY_TYPE_LABELS, DRIVE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/nav";
import { socialProfiles } from "@/lib/social-links";
import { site } from "@/config/site";
import { seo } from "@/config/seo";
import { hasAddress, type BusinessProfile } from "@/config/business";
import type { VehicleDetail, VehicleListItem, Faq } from "@/lib/domain";

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
    name: site.brandName,
    description: seo.defaultDescription,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: site.locale,
  };
}

/**
 * Brand Organization entity powering the knowledge panel.
 *
 * Deliberately carries NO `aggregateRating`: Google excludes self-serving
 * review markup on Organization/LocalBusiness from rich results, and the only
 * figures we hold are dealer-entered. Contact details and social profiles are
 * emitted only when configured.
 */
export function organizationSchema(business: BusinessProfile) {
  const base = siteBaseUrl();
  const sameAs = socialProfiles(business.social).map((p) => p.url);
  const name = business.tradingName || site.brandName;
  const phone = business.phone || business.whatsapp;

  return {
    "@context": CONTEXT,
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name,
    ...(business.legalName ? { legalName: business.legalName } : {}),
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}${site.assets.icon512}`,
      width: 512,
      height: 512,
    },
    image: `${base}${seo.ogImage}`,
    description: seo.defaultDescription,
    areaServed: { "@type": "Country", name: site.country },
    ...(phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: phone,
            contactType: "sales",
            areaServed: site.countryCode,
            availableLanguage: [site.locale],
          },
        }
      : {}),
    ...(business.email ? { email: business.email } : {}),
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
 *  • `@id` + `mainEntityOfPage` anchor the vehicle to its canonical URL.
 *  • All gallery images, not just the cover.
 *  • `sku` is the dealer's stock number. The VIN is deliberately NOT emitted:
 *    the site only holds a masked VIN, and a masked value published as
 *    `vehicleIdentificationNumber` would be false data.
 *  • No `priceValidUntil` or `productionDate`: the site has no real value for
 *    either, and an invented one is worse than an absent one.
 *  • `driveWheelConfiguration`, `numberOfDoors`, `vehicleEngine`, `vehicleConfiguration`.
 *  • The Offer's `seller` and `availableAtOrFrom` reference the site-wide
 *    AutoDealer node by `@id`, so the dealership's Google review aggregate
 *    (which is what surfaces stars beside a vehicle result) resolves from one
 *    entity rather than a detached copy per vehicle.
 */
export function vehicleSchema(v: VehicleDetail, opts: { path: string }) {
  const url = absoluteUrl(opts.path);
  const availability =
    v.status === "sold" ? "https://schema.org/SoldOut"
    : v.status === "reserved" ? "https://schema.org/LimitedAvailability"
    : "https://schema.org/InStock";

  const name = `${v.year} ${v.makeName} ${v.modelName}${v.variant ? ` ${v.variant}` : ""}`;
  const images = v.images.map((img) => img.url).filter(Boolean);

  return {
    "@context": CONTEXT,
    // `Car` is the type Google's vehicle listing results read.
    "@type": "Car",
    "@id": `${url}#vehicle`,
    name,
    ...(v.description ? { description: v.description } : {}),
    url,
    mainEntityOfPage: url,
    brand: { "@type": "Brand", name: v.makeName },
    model: v.modelName,
    ...(v.variant ? { vehicleConfiguration: v.variant } : {}),
    vehicleModelDate: String(v.year),
    bodyType: BODY_TYPE_LABELS[v.bodyType],
    fuelType: FUEL_LABELS[v.fuelType],
    vehicleTransmission: TRANSMISSION_LABELS[v.transmission],
    itemCondition: "https://schema.org/UsedCondition",
    ...(v.stockId ? { sku: v.stockId } : {}),
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
 * The physical dealership (AutoDealer, a LocalBusiness). Distinct from the
 * brand `organizationSchema` and linked to it via `parentOrganization`, so
 * Google resolves one brand with one storefront.
 *
 * Address, geo and opening hours are emitted ONLY when the client has entered
 * real premises in Admin → Settings — a LocalBusiness with an invented address
 * is a spam-policy violation, not an SEO win. No review aggregate (see
 * organizationSchema).
 */
export function autoDealerSchema(business: BusinessProfile) {
  const base = siteBaseUrl();
  const hours = openingHours(business.hours as Record<string, string>);
  const a = business.address;
  return {
    "@context": CONTEXT,
    "@type": "AutoDealer",
    "@id": LOCAL_BUSINESS_ID,
    name: business.tradingName || site.brandName,
    url: base,
    image: `${base}${seo.ogImage}`,
    logo: `${base}${site.assets.icon512}`,
    parentOrganization: { "@id": ORGANIZATION_ID },
    currenciesAccepted: site.currency,
    areaServed: { "@type": "Country", name: site.country },
    ...(business.email ? { email: business.email } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(hasAddress(a)
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: a.street,
            addressLocality: a.suburb,
            addressRegion: a.state,
            ...(a.postcode ? { postalCode: a.postcode } : {}),
            addressCountry: site.countryCode,
          },
          ...(hours.length > 0 ? { openingHours: hours } : {}),
        }
      : {}),
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
    publisher: { "@id": ORGANIZATION_ID },
  };
}
