import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  evaluateGeoAccess,
  getAllowedCountries,
  isCountryAllowed,
  isGeoExemptPath,
  isGeoRestrictionEnabled,
  prefersMachineReadableResponse,
  resolveCountry,
} from "./geo-restriction";

const ENV_KEYS = [
  "GEO_RESTRICTION_ENABLED",
  "GEO_ALLOWED_COUNTRIES",
  "GEO_TRUST_PROXY_HEADERS",
  "GEO_DEV_COUNTRY",
  "VERCEL",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  // Simulate running behind the Vercel edge so the geo headers are trusted.
  process.env.VERCEL = "1";
  process.env.GEO_RESTRICTION_ENABLED = "true";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

/** Convenience: a request as seen by the edge proxy. */
function req(country: string | null, extra: Record<string, string> = {}) {
  const headers = new Headers(extra);
  if (country) headers.set("x-vercel-ip-country", country);
  return headers;
}

describe("getAllowedCountries", () => {
  it("defaults to AU + IN when unset", () => {
    expect([...getAllowedCountries()].sort()).toEqual(["AU", "IN"]);
  });

  it("parses a comma-separated list, trimming and upper-casing", () => {
    process.env.GEO_ALLOWED_COUNTRIES = " au , in , nz ";
    expect([...getAllowedCountries()].sort()).toEqual(["AU", "IN", "NZ"]);
  });

  it("falls back to the default rather than locking everyone out on a bad value", () => {
    process.env.GEO_ALLOWED_COUNTRIES = "  , not-a-code, ";
    expect([...getAllowedCountries()].sort()).toEqual(["AU", "IN"]);
  });
});

describe("isGeoRestrictionEnabled", () => {
  it("is enabled by default", () => {
    expect(isGeoRestrictionEnabled()).toBe(true);
  });

  it("is enabled only by an explicit 'true'", () => {
    process.env.GEO_RESTRICTION_ENABLED = "true";
    expect(isGeoRestrictionEnabled()).toBe(true);

    process.env.GEO_RESTRICTION_ENABLED = "false";
    expect(isGeoRestrictionEnabled()).toBe(false);

    process.env.GEO_RESTRICTION_ENABLED = "0";
    expect(isGeoRestrictionEnabled()).toBe(false);
  });
});

describe("resolveCountry", () => {
  it("reads the Vercel header when running on Vercel", () => {
    expect(resolveCountry(req("au"))).toBe("AU");
  });

  it("reads the Cloudflare header", () => {
    expect(resolveCountry(new Headers({ "cf-ipcountry": "IN" }))).toBe("IN");
  });

  it("ignores client-supplied headers when no trusted edge is proven", () => {
    delete process.env.VERCEL;
    expect(resolveCountry(req("AU"))).toBeNull();
  });

  it("trusts proxy headers when explicitly opted in", () => {
    delete process.env.VERCEL;
    process.env.GEO_TRUST_PROXY_HEADERS = "true";
    expect(resolveCountry(new Headers({ "x-geo-country": "US" }))).toBe("US");
  });

  it("treats edge placeholder codes as unknown", () => {
    expect(resolveCountry(req("XX"))).toBeNull();
    expect(resolveCountry(req("T1"))).toBeNull();
  });

  it("ignores malformed values", () => {
    expect(resolveCountry(req("AUS"))).toBeNull();
    expect(resolveCountry(req(""))).toBeNull();
  });
});

describe("isCountryAllowed", () => {
  it("accepts the served markets, case-insensitively", () => {
    expect(isCountryAllowed("AU")).toBe(true);
    expect(isCountryAllowed("in")).toBe(true);
  });

  it("rejects everything else and null", () => {
    expect(isCountryAllowed("US")).toBe(false);
    expect(isCountryAllowed("NZ")).toBe(false);
    expect(isCountryAllowed(null)).toBe(false);
  });
});

describe("isGeoExemptPath", () => {
  it("exempts SEO discovery artefacts", () => {
    expect(isGeoExemptPath("/robots.txt")).toBe(true);
    expect(isGeoExemptPath("/sitemap.xml")).toBe(true);
    expect(isGeoExemptPath("/sitemap/0.xml")).toBe(true);
    expect(isGeoExemptPath("/llms.txt")).toBe(true);
    expect(isGeoExemptPath("/manifest.webmanifest")).toBe(true);
  });

  it("exempts infrastructure endpoints", () => {
    expect(isGeoExemptPath("/api/health")).toBe(true);
    expect(isGeoExemptPath("/api/cron/reminders")).toBe(true);
    expect(isGeoExemptPath("/.well-known/acme-challenge/abc")).toBe(true);
    expect(isGeoExemptPath("/geo-blocked")).toBe(true);
  });

  it("does not exempt real application paths", () => {
    expect(isGeoExemptPath("/")).toBe(false);
    expect(isGeoExemptPath("/used-cars")).toBe(false);
    expect(isGeoExemptPath("/api/v1/leads")).toBe(false);
    expect(isGeoExemptPath("/admin/inventory")).toBe(false);
  });
});

describe("evaluateGeoAccess", () => {
  const CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
  const GOOGLEBOT_UA =
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

  it("allows Australian and Indian visitors", () => {
    expect(evaluateGeoAccess({ headers: req("AU"), pathname: "/", userAgent: CHROME_UA }))
      .toEqual({ blocked: false, country: "AU", reason: "allowed" });
    expect(evaluateGeoAccess({ headers: req("IN"), pathname: "/used-cars", userAgent: CHROME_UA }))
      .toEqual({ blocked: false, country: "IN", reason: "allowed" });
  });

  it("blocks every other country", () => {
    expect(evaluateGeoAccess({ headers: req("US"), pathname: "/", userAgent: CHROME_UA }))
      .toEqual({ blocked: true, country: "US" });
    expect(evaluateGeoAccess({ headers: req("GB"), pathname: "/api/v1/leads", userAgent: CHROME_UA }))
      .toEqual({ blocked: true, country: "GB" });
  });

  it("never blocks Googlebot — it crawls from US IPs and must reach every page", () => {
    const decision = evaluateGeoAccess({
      headers: req("US"),
      pathname: "/used-cars/toyota/hilux",
      userAgent: GOOGLEBOT_UA,
    });
    expect(decision).toEqual({ blocked: false, country: null, reason: "crawler" });
  });

  it("never blocks SEO artefacts, even from a blocked country", () => {
    expect(evaluateGeoAccess({ headers: req("US"), pathname: "/robots.txt" }).blocked).toBe(false);
    expect(evaluateGeoAccess({ headers: req("US"), pathname: "/sitemap.xml" }).blocked).toBe(false);
  });

  it("fails open when the country cannot be resolved", () => {
    expect(evaluateGeoAccess({ headers: new Headers(), pathname: "/", userAgent: CHROME_UA }))
      .toEqual({ blocked: false, country: null, reason: "unknown" });
  });

  it("fails open for every request when the kill switch is set", () => {
    process.env.GEO_RESTRICTION_ENABLED = "false";
    expect(evaluateGeoAccess({ headers: req("US"), pathname: "/", userAgent: CHROME_UA }))
      .toEqual({ blocked: false, country: null, reason: "disabled" });
  });

  it("honours a widened allowlist", () => {
    process.env.GEO_ALLOWED_COUNTRIES = "AU,IN,NZ";
    expect(evaluateGeoAccess({ headers: req("NZ"), pathname: "/", userAgent: CHROME_UA }).blocked)
      .toBe(false);
  });
});

describe("prefersMachineReadableResponse", () => {
  it("is true for API routes", () => {
    expect(
      prefersMachineReadableResponse({
        method: "GET",
        pathname: "/api/v1/leads",
        headers: new Headers(),
      }),
    ).toBe(true);
  });

  it("is true for any mutation, including Server Action POSTs to page routes", () => {
    expect(
      prefersMachineReadableResponse({
        method: "POST",
        pathname: "/contact",
        headers: new Headers({ "next-action": "abc123" }),
      }),
    ).toBe(true);
  });

  it("is true for JSON-only clients", () => {
    expect(
      prefersMachineReadableResponse({
        method: "GET",
        pathname: "/used-cars",
        headers: new Headers({ accept: "application/json" }),
      }),
    ).toBe(true);
  });

  it("is false for ordinary browser navigation", () => {
    expect(
      prefersMachineReadableResponse({
        method: "GET",
        pathname: "/used-cars",
        headers: new Headers({ accept: "text/html,application/xhtml+xml" }),
      }),
    ).toBe(false);
  });
});
