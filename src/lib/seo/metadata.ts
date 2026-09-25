import type { Metadata } from "next";
import { absoluteUrl, canonical } from "@/lib/seo/site";
import { site } from "@/config/site";
import { seo } from "@/config/seo";

/**
 * Builds a complete, self-consistent metadata block for a page.
 *
 * Centralising this fixes a class of bug the codebase had everywhere: pages set
 * only `title` + `description`, then inherited `alternates.canonical` and
 * `openGraph.url` from the root layout — both of which pointed at the homepage.
 * Every page therefore told Google and every social crawler that it *was* the
 * homepage. Routing all pages through one builder makes the canonical, the OG
 * URL and the Twitter card agree by construction.
 *
 * Australian defaults (`en_AU` locale, the configured brand name) are baked in
 * so no caller has to remember them.
 */
export function pageMetadata(input: {
  /** Clean, query-free path this page canonicalises to. */
  path: string;
  title: string;
  description: string;
  /** Absolute or root-relative image; falls back to the site OG image. */
  image?: string | null;
  /** Set for utility pages that should stay out of the index. */
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  const image = input.image || seo.ogImage;

  return {
    title: input.title,
    description: input.description,
    alternates: canonical(input.path),
    ...(input.noindex
      ? { robots: { index: false, follow: true, googleBot: { index: false, follow: true } } }
      : { robots: { index: true, follow: true } }),
    openGraph: {
      type: "website",
      locale: site.ogLocale,
      siteName: site.brandName,
      url,
      title: input.title,
      description: input.description,
      images: [{ url: image, width: 1200, height: 630, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
