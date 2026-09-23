import { site } from "@/config/site";

/**
 * SEO defaults. Location phrases are intentionally EMPTY until the client
 * supplies real premises (D-05): a title like "Used cars in <suburb>" is a
 * local-SEO claim and must not be invented.
 */
export const seo = {
  /** `%s | AutoHauz` for inner pages. */
  titleTemplate: `%s | ${site.brandName}`,
  defaultTitle: `${site.brandName} — ${site.tagline}`,
  defaultDescription:
    "Browse quality, inspected used cars for sale. Transparent pricing, finance options and trade-ins welcome. Enquire online or get in touch with our team.",
  /** Appended to programmatic titles when set, e.g. "in Parramatta, NSW". Empty = omitted. */
  regionPhrase: "",
  /** Default social image (1200×630). */
  ogImage: site.assets.ogImage,
  /** Site-wide search: `/used-cars?q={query}` powers the WebSite SearchAction. */
  searchPath: "/used-cars",
  searchParam: "q",
} as const;

/** "Used Toyota Corolla" + region → "Used Toyota Corolla in Parramatta, NSW" only when a region is configured. */
export function withRegion(text: string): string {
  return seo.regionPhrase ? `${text} ${seo.regionPhrase}` : text;
}
