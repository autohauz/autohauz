/**
 * Thin-content indexation guards for programmatic landing pages.
 *
 * A `/used-cars/{make}` or `/used-cars/body/{type}` page holding one car — or
 * none — is a thin page: it offers a searcher nothing. At the scale this site
 * generates landing pages (every make × every model × every body type × every
 * budget band), a long tail of near-empty pages is exactly the "scaled content"
 * pattern Google's helpful-content systems demote. That demotion is site-wide,
 * not per-page, so a few hundred empty model pages can drag down the vehicle
 * pages that actually convert.
 *
 * The fix is not to stop generating them — inventory turns over, and today's
 * empty Kia Sportage page is next month's money page. It is to keep thin pages
 * `noindex, follow` until they carry enough stock to deserve a click, and let
 * them re-enter the index automatically once they do.
 *
 * `follow` is deliberate throughout: even an empty landing page should pass
 * link equity onward to the vehicles and hubs it links to.
 *
 * These helpers previously used rental-era city/category thresholds imported
 * from `seo/constants.ts` and were never called from anywhere. The thresholds
 * now live here, in the only module that reads them, and the guards are wired
 * into the listing routes.
 */

/** Minimum listings a programmatic landing page needs before it may be indexed. */
export const THIN_PAGE_THRESHOLDS = {
  /** Make and model hubs — a single car does not justify a dedicated page. */
  makeModel: 2,
  /** Body-type and budget hubs sit broader, so expect more stock. */
  category: 3,
} as const;

export type ThinPageKind = keyof typeof THIN_PAGE_THRESHOLDS;

type RobotsDirective = {
  index: boolean;
  follow: boolean;
  googleBot: { index: boolean; follow: boolean };
};

/** True when a landing page carries enough stock to belong in the index. */
export function isIndexableLanding(total: number, kind: ThinPageKind): boolean {
  return total >= THIN_PAGE_THRESHOLDS[kind];
}

/**
 * Robots directive for a programmatic landing page holding `total` vehicles.
 * Returns `undefined` when the page is fat enough to index, so callers can
 * spread it and leave the surrounding metadata's own robots value in place.
 */
export function thinPageRobots(total: number, kind: ThinPageKind): RobotsDirective | undefined {
  if (isIndexableLanding(total, kind)) return undefined;
  return { index: false, follow: true, googleBot: { index: false, follow: true } };
}
