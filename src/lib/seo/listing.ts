import type { Metadata } from "next";
import { canonical } from "@/lib/seo/site";
import { pageMetadata } from "@/lib/seo/metadata";
import { thinPageRobots, type ThinPageKind } from "@/lib/seo/guards";

type SP = Record<string, string | string[] | undefined>;

/**
 * Faceted-navigation indexation policy for every inventory listing route
 * (`/used-cars`, `/used-cars/[make]`, `/used-cars/[make]/[model]`,
 * `/used-cars/body/[bodyType]`, `/used-cars/under-{price}`).
 *
 * The filter UI writes its state to the query string, so a single hub page can
 * generate a combinatorial explosion of URLs — `?fuel=diesel&sort=price_asc`,
 * `?transmission=manual&seats=7&km_max=80000`, and so on. Left alone, Google
 * crawls and indexes those permutations as near-duplicates of the hub, which
 * burns crawl budget and dilutes the ranking signals that should concentrate on
 * the hub itself.
 *
 * The policy, which matches what `/search` already does:
 *  • Filtered or sorted URLs  → `noindex, follow` + canonical to the clean hub.
 *    `follow` matters: bots still traverse into the VDPs those pages link to.
 *  • Paginated URLs (`?page=n`) → indexable with a SELF-referencing canonical.
 *    Google retired rel=prev/next, and canonicalising page 2+ back to page 1
 *    hides deep inventory from the index entirely, so each page owns itself.
 *  • The clean hub → indexable, self-canonical.
 */

/** Query keys the listing UI uses as facets. `page` is deliberately excluded. */
const FACET_KEYS = [
  "make", "model", "body", "fuel", "transmission", "drive", "seats",
  "price_min", "price_max", "year_min", "year_max", "km_max", "city", "q", "sort",
] as const;

function firstValue(sp: SP, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v)) return v[0]?.trim() || undefined;
  return undefined;
}

/** True when the URL narrows or reorders the hub's result set. */
export function hasActiveFacets(sp: SP): boolean {
  return FACET_KEYS.some((key) => firstValue(sp, key) !== undefined);
}

/** Current page number from the query string (1 when absent or invalid). */
export function currentPage(sp: SP): number {
  const raw = firstValue(sp, "page");
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Builds the indexation half of a listing route's metadata: canonical URL plus
 * the robots directives implied by the facets in play.
 *
 * `basePath` must be the clean hub path with no query string.
 */
export function listingIndexation(basePath: string, sp: SP): Pick<Metadata, "alternates" | "robots"> {
  const faceted = hasActiveFacets(sp);
  const page = currentPage(sp);

  // Paginated-but-unfiltered pages are real, indexable inventory depth and get
  // a self-referencing canonical that keeps the page number.
  const canonicalPath = !faceted && page > 1 ? `${basePath}?page=${page}` : basePath;

  return {
    alternates: canonical(canonicalPath),
    robots: faceted
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : { index: true, follow: true },
  };
}

/**
 * Appends " - Page N" to a paginated listing's title so page 2+ never competes
 * with the hub for the same snippet in the SERPs.
 */
export function paginatedTitle(title: string, sp: SP): string {
  const page = currentPage(sp);
  return page > 1 ? `${title} - Page ${page}` : title;
}

/**
 * Complete metadata for an inventory listing route: the shared page block from
 * `pageMetadata` with the facet/pagination indexation rules layered on top.
 * The indexation half wins, since it is the one that understands the query.
 */
export function listingMetadata(input: {
  basePath: string;
  sp: SP;
  title: string;
  description: string;
  keywords?: string[];
  /**
   * Live stock count for this landing page. When supplied, a page that is too
   * thin to be useful is held out of the index until inventory grows into it.
   */
  thin?: { total: number; kind: ThinPageKind };
}): Metadata {
  const title = paginatedTitle(input.title, input.sp);
  const indexation = listingIndexation(input.basePath, input.sp);
  const thinRobots = input.thin ? thinPageRobots(input.thin.total, input.thin.kind) : undefined;

  return {
    ...pageMetadata({
      path: input.basePath,
      title,
      description: input.description,
      keywords: input.keywords,
    }),
    ...indexation,
    // A thin page is noindex regardless of facets; the facet rule can only
    // ever make a page *less* indexable, never more.
    ...(thinRobots ? { robots: thinRobots } : {}),
  };
}
