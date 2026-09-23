import { siteBaseUrl } from "@/lib/seo/site";
import type { CanonicalVehicle } from "@/lib/syndication/types";

/** Same slugging as the catalogue: lower-case, non-alphanumerics → "-", trimmed. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Public vehicle-detail URL for a syndicated listing.
 *
 * Uses the configured site origin (never a hard-coded domain) and the real
 * route shape `/used-cars/{makeSlug}/{modelSlug}/{vehicleSlug}`. Slugs come
 * from the projection when migration 0020 has been applied; until then the
 * make/model names are slugified and the stock number stands in for the
 * vehicle slug (the previous behaviour, which only matches for single-word
 * makes and stock-only slugs — apply 0020 before going live on any channel).
 */
export function listingUrl(v: Pick<CanonicalVehicle, "make" | "model" | "stockNumber" | "makeSlug" | "modelSlug" | "vehicleSlug">): string {
  const makeSlug = v.makeSlug || slugify(v.make);
  const modelSlug = v.modelSlug || slugify(v.model);
  const vehicleSlug = v.vehicleSlug || slugify(v.stockNumber);
  return `${siteBaseUrl()}/used-cars/${makeSlug}/${modelSlug}/${vehicleSlug}`;
}
