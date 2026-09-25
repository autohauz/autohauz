/**
 * Good-faith crawler identification — shared by the edge proxy UA blocklist and
 * the geo-restriction gate.
 *
 * This list previously lived inside the edge proxy. It moved here because two
 * independent enforcement layers now need the same answer to "is this a
 * legitimate search/social crawler?":
 *
 *  1. The bad-bot 403 blocklist (never 403 a real crawler).
 *  2. The geo restriction (see `geo-restriction.ts`) — Googlebot and Bingbot
 *     crawl predominantly from **US** data centres. Geo-blocking them would
 *     silently de-index the entire site, so verified-by-UA crawlers are exempt.
 *
 * SECURITY NOTE: a User-Agent is trivially spoofable, so this exemption is a
 * deliberate trade-off. The downside of a spoofed UA is that one visitor sees
 * public marketing pages they were meant to be geo-fenced from — a marketing
 * concern. The downside of geo-blocking Googlebot is total loss of organic
 * search presence — a business-ending concern. Availability of *public* data
 * wins. Anything sensitive (admin, API mutations, auth) is protected by real
 * authentication and RLS, never by geography alone.
 *
 * Reverse-DNS crawler verification is the robust alternative but is not
 * available in the edge runtime (no DNS resolver). If stricter enforcement is
 * ever required, do it at the CDN layer (Cloudflare "Verified Bots").
 */

/** Good-faith SEO / social bots we NEVER block (SEO must not be impacted). */
export const ALLOWED_BOTS = [
  "googlebot",
  "bingbot",
  "slurp",          // Yahoo
  "duckduckbot",
  "baiduspider",
  "sogou",
  "exabot",
  "facebot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "whatsapp",
  "applebot",
  "yeti",           // Naver (Korean search)
  "pinterestbot",
  "tumblr",
  "telegrambot",
  // Google's own tools (Search Console URL Inspection, Rich Results Test, Ads, Merchant)
  "google-inspectiontool",
  "adsbot-google",
  "storebot-google",
  "googleother",
  // AI *search* / answer crawlers (training crawlers stay blocked in robots.txt)
  "oai-searchbot",
  "chatgpt-user",
  "perplexitybot",
  "claude-searchbot",
  "claude-user",
] as const;

/**
 * Returns true if the User-Agent self-identifies as a good-faith search or
 * social crawler. Case-insensitive substring match — crawler UAs embed their
 * token inside a longer string (e.g. "Mozilla/5.0 (compatible; Googlebot/2.1)").
 */
export function isAllowedBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const lower = userAgent.toLowerCase();

  for (const allowed of ALLOWED_BOTS) {
    if (lower.includes(allowed)) return true;
  }

  return false;
}
