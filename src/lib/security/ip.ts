import { createHash, createHmac } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Client IP + privacy-preserving IP hashing — the single implementation used
 * by rate limiting, spam checks and analytics. Raw IPs are never stored.
 */

/**
 * Client IP for rate limiting and abuse controls.
 *
 * Only headers written by infrastructure we actually sit behind are trusted:
 * a header the platform does not set is passed through from the client
 * verbatim, so trusting it lets anyone rotate "their IP" per request and
 * bypass every per-IP limit.
 *  - Vercel overwrites `x-real-ip` / `x-forwarded-for` with the real client.
 *  - `cf-connecting-ip` is trusted only when self-hosting behind Cloudflare
 *    (`GEO_TRUST_PROXY_HEADERS=true`, the same opt-in the geo gate uses).
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  if (process.env.VERCEL === "1") {
    return realIp || forwarded || "0.0.0.0";
  }

  if (process.env.GEO_TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true") {
    const cf = headers.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }

  return forwarded || realIp || "0.0.0.0";
}

let warnedMissingSalt = false;

/**
 * Resolves the HMAC key for IP hashing.
 *
 * `IP_HASH_SECRET` is the intended source. In production without it we do NOT
 * fall back to a well-known constant (a rainbow table would reverse every
 * stored hash); instead the key is derived from the service-role key, which is
 * secret and identical across instances, so hashes stay stable for rate
 * limiting and deduplication. A loud error is logged once so it gets fixed.
 */
function hashKey(): string {
  if (env.IP_HASH_SECRET) return env.IP_HASH_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!warnedMissingSalt) {
      warnedMissingSalt = true;
      console.error(
        "[security] IP_HASH_SECRET is not set in production. Deriving a hashing key from " +
          "SUPABASE_SERVICE_ROLE_KEY as a stopgap — set IP_HASH_SECRET to a dedicated random value.",
      );
    }
    return createHash("sha256").update(`ip-hash:${env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex");
  }

  return "development-only-ip-salt";
}

/** Salted, non-reversible hash of a client IP (32 hex chars). */
export function hashIp(ip: string): string {
  return createHmac("sha256", hashKey()).update(ip).digest("hex").slice(0, 32);
}
