import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/seo/site";

/**
 * robots.txt — crawl policy (not access control: private areas are protected
 * by authentication, and also carry `X-Robots-Tag: noindex`).
 *
 * Rules that matter:
 *  • Private paths (admin, API, auth, the geo-block rewrite target) are
 *    disallowed for everyone.
 *  • Utility pages that must stay out of the index (/thank-you, unsubscribe,
 *    confirmation) are NOT disallowed: they carry `noindex`, and a crawler can
 *    only obey a noindex it is allowed to fetch.
 *  • `/_next/` stays crawlable — blocking the site's JS/CSS stops non-Google
 *    crawlers (Bing, Apple, AI search) from rendering pages at all.
 *  • AI *training* crawlers are refused (the owner's choice); AI *search*
 *    crawlers (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot)
 *    are allowed so the dealership can appear in AI answers.
 */
const PRIVATE = ["/admin", "/admin/", "/admin-login", "/api/", "/auth/", "/geo-blocked"];

const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Bytespider",
  "cohere-ai",
  "Omgilibot",
  "PetalBot",
];

const HIGH_VOLUME_SEO_TOOLS = ["MJ12bot", "DotBot", "BLEXBot", "DataForSeoBot", "serpstatbot", "SeobilityBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
      ...HIGH_VOLUME_SEO_TOOLS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${siteBaseUrl()}/sitemap.xml`,
  };
}
