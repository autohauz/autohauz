/**
 * Geo-restriction policy — the app is served only to Australia (AU) and
 * India (IN).
 *
 * ── Where this runs ──────────────────────────────────────────────────────────
 * Enforcement lives in `src/proxy.ts` (edge proxy, formerly middleware), the earliest
 * point in the request lifecycle we control: it executes before routing,
 * rendering, Server Actions, route handlers, and the Supabase session lookup.
 * This module is deliberately pure — it reads only the request Headers, the
 * pathname and the User-Agent — so it is cheap (a handful of header reads and
 * string comparisons, no I/O) and fully unit-testable.
 *
 * ── Where the country comes from ─────────────────────────────────────────────
 * The visitor's country is resolved by the CDN/edge network from the TCP peer
 * address and injected as a request header *by the platform*, which strips or
 * overwrites any client-supplied value of the same name:
 *
 *   • Vercel      → `x-vercel-ip-country`
 *   • Cloudflare  → `cf-ipcountry`
 *   • Custom LB   → `x-geo-country` (nginx GeoIP2, CloudFront, Fastly, …)
 *
 * These headers are only trusted when we know we are actually behind such an
 * edge (`VERCEL=1`, or an explicit `GEO_TRUST_PROXY_HEADERS=true` opt-in for
 * self-hosted deployments behind a geo-aware proxy). Without that proof the
 * headers are attacker-controlled and are ignored entirely — the app never
 * geo-decides on a value a browser could have forged.
 *
 * ── Failure mode: fail OPEN ──────────────────────────────────────────────────
 * When the country cannot be resolved (local dev, an edge that did not resolve
 * the IP, Vercel's `XX` placeholder, Tor exit nodes reported as `T1`) the
 * request is allowed. This is intentional for a public lead-generation site:
 * a mis-resolved IP costing a real Australian buyer their session is a direct
 * revenue loss, while a stray unresolved visitor seeing public marketing pages
 * costs nothing. Everything that actually matters — admin, auth, data — is
 * protected by authentication and Postgres RLS, never by geography.
 *
 * ── Configuration ────────────────────────────────────────────────────────────
 *   GEO_RESTRICTION_ENABLED   "false" → kill switch, disables the gate entirely
 *   GEO_ALLOWED_COUNTRIES     comma-separated ISO 3166-1 alpha-2 (default "AU,IN")
 *   GEO_TRUST_PROXY_HEADERS   "true" → trust geo headers when not on Vercel
 *   GEO_DEV_COUNTRY           non-production only: simulate a country locally
 */

import { isAllowedBot } from "@/lib/security/bots";

/** Route the edge proxy rewrites blocked page requests to. */
export const GEO_BLOCKED_PATH = "/geo-blocked";

/**
 * Default policy. Kept as a constant (rather than only an env default) so the
 * blocked page and tests share one source of truth for the copy "Australia".
 */
export const DEFAULT_ALLOWED_COUNTRIES = ["AU"] as const;

/**
 * Platform-injected geo headers, in trust order. The first one present wins.
 * Never add a header a client could plausibly set on its own.
 */
const GEO_HEADERS = [
  "x-vercel-ip-country", // Vercel Edge Network
  "cf-ipcountry",        // Cloudflare
  "x-geo-country",       // Generic reverse proxy / custom LB
] as const;

/**
 * Placeholder values edges emit when the IP could not be mapped to a country.
 * Treated as "unknown", not as "disallowed" (see fail-open rationale above).
 */
const UNRESOLVED_COUNTRY_CODES = new Set(["XX", "T1", "ZZ", "A1", "A2", "O1", "AP", "EU"]);

/**
 * Paths that must never be geo-blocked.
 *
 * SEO/infra artefacts (robots.txt, sitemaps) are fetched by crawlers from
 * anywhere in the world and contain nothing but public URLs — blocking them
 * would break indexing for the *target* market. `/api/health` keeps external
 * uptime monitoring working, `/api/cron/*` keeps the external scheduler working
 * (both already fail-closed on their own secrets), and `/.well-known/*` must
 * stay open for ACME certificate issuance and app-association files.
 */
const EXEMPT_PATHS = new Set<string>([
  GEO_BLOCKED_PATH,
  "/favicon.ico",
  "/api/health",
]);

const EXEMPT_PREFIXES = [
  "/.well-known/",
  "/api/cron/",
  "/_next/",
  "/brand/",
  "/images/",
] as const;

/**
 * Static text/XML discovery artefacts: robots.txt, sitemap.xml, sitemap/0.xml,
 * llms.txt, opensearch.xml, ads.txt, security.txt. All are public-by-design and
 * carry no user data, so a blanket suffix exemption is safe and cheaper than
 * enumerating filenames.
 */
const EXEMPT_SUFFIXES = [".xml", ".txt", ".webmanifest"] as const;

// ── Env parsing (memoised on the raw value so tests can mutate process.env) ──
let cachedRawCountries: string | undefined;
let cachedCountrySet: Set<string> = new Set([...DEFAULT_ALLOWED_COUNTRIES, "IN"]);

/**
 * Allowed ISO 3166-1 alpha-2 country codes, upper-cased. Falls back to the
 * AU/IN default when `GEO_ALLOWED_COUNTRIES` is unset or contains no usable
 * entries — an empty/typo'd value must never lock every visitor out.
 */
export function getAllowedCountries(): Set<string> {
  const raw = process.env.GEO_ALLOWED_COUNTRIES;

  if (raw === cachedRawCountries) return cachedCountrySet;

  const parsed = (raw ?? "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));

  cachedRawCountries = raw;
  cachedCountrySet = parsed.length > 0 ? new Set(parsed) : new Set(DEFAULT_ALLOWED_COUNTRIES);

  // ALWAYS allow India (IN) for the development team
  cachedCountrySet.add("IN");

  return cachedCountrySet;
}

/** Kill switch. Disabled by default to allow VPNs globally unless explicitly opted in. */
export function isGeoRestrictionEnabled(): boolean {
  return process.env.GEO_RESTRICTION_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * True when we can prove an edge network resolved the client IP for us, and the
 * geo headers therefore cannot be forged by the client.
 */
function trustsGeoHeaders(): boolean {
  if (process.env.VERCEL === "1") return true;
  return process.env.GEO_TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true";
}

/**
 * Resolves the visitor's country, or `null` when unknown.
 *
 * Returns `null` rather than throwing/guessing so the caller owns the
 * fail-open decision in one place.
 */
export function resolveCountry(headers: Headers): string | null {
  // Local/preview override — never honoured in production, so it can't become a
  // production bypass if the variable leaks into the deployed environment.
  if (process.env.NODE_ENV !== "production") {
    const simulated = process.env.GEO_DEV_COUNTRY?.trim().toUpperCase();
    if (simulated && /^[A-Z]{2}$/.test(simulated)) return simulated;
  }

  if (!trustsGeoHeaders()) return null;

  for (const header of GEO_HEADERS) {
    const value = headers.get(header)?.trim().toUpperCase();
    if (!value || !/^[A-Z]{2}$/.test(value)) continue;
    if (UNRESOLVED_COUNTRY_CODES.has(value)) return null;
    return value;
  }

  return null;
}

/** Membership check against the configured allowlist. */
export function isCountryAllowed(country: string | null | undefined): boolean {
  if (!country) return false;
  const code = country.trim().toUpperCase();
  // Unconditional fast-path for the target market and the development team.
  if (code === "AU" || code === "IN") return true;
  return getAllowedCountries().has(code);
}

/** Paths exempt from the gate — SEO artefacts, health checks, static assets. */
export function isGeoExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true;
  if (EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (EXEMPT_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) return true;
  return false;
}

/** Why a request was allowed — useful for observability and for tests. */
export type GeoAllowReason =
  | "disabled"      // kill switch
  | "exempt-path"   // robots.txt, sitemaps, health, .well-known, static
  | "crawler"       // good-faith search/social bot (SEO safety)
  | "unknown"       // country could not be resolved → fail open
  | "allowed";      // resolved to an allowed country

export type GeoDecision =
  | { blocked: false; country: string | null; reason: GeoAllowReason }
  | { blocked: true; country: string };

/**
 * The single geo decision for a request. Pure and allocation-light: on the hot
 * path (an allowed Australian visitor) this is one env read, one header read
 * and one Set lookup.
 */
export function evaluateGeoAccess(request: {
  headers: Headers;
  pathname: string;
  userAgent?: string | null;
}): GeoDecision {
  if (!isGeoRestrictionEnabled()) {
    return { blocked: false, country: null, reason: "disabled" };
  }

  if (isGeoExemptPath(request.pathname)) {
    return { blocked: false, country: null, reason: "exempt-path" };
  }

  // SEO: search/social crawlers are exempt regardless of origin country.
  if (isAllowedBot(request.userAgent)) {
    return { blocked: false, country: null, reason: "crawler" };
  }

  const country = resolveCountry(request.headers);

  if (country === null) {
    return { blocked: false, country: null, reason: "unknown" };
  }

  if (isCountryAllowed(country)) {
    return { blocked: false, country, reason: "allowed" };
  }

  return { blocked: true, country };
}

/**
 * True when a blocked request should get a machine-readable 451 body instead of
 * the branded HTML page.
 *
 * Covers `/api/*`, every non-GET/HEAD request (Server Action POSTs to page
 * routes included — those must never execute from a blocked country), and
 * clients that explicitly asked for JSON.
 */
export function prefersMachineReadableResponse(request: {
  method: string;
  pathname: string;
  headers: Headers;
}): boolean {
  if (request.pathname.startsWith("/api/")) return true;
  if (request.method !== "GET" && request.method !== "HEAD") return true;

  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}
