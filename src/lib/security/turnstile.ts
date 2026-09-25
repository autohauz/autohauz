import "server-only";
import { env } from "@/lib/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5000;

export type TurnstileResult =
  /** Token verified by Cloudflare. */
  | { ok: true; status: "verified" }
  /** Verification deliberately skipped (local development only). */
  | { ok: true; status: "skipped" }
  /** Missing, invalid, expired, reused or wrong-host token — treat as a bot. */
  | { ok: false; status: "failed"; reason: string }
  /**
   * Cloudflare could not be reached, or the site is misconfigured. This says
   * nothing about the visitor, so callers must not treat it as spam.
   */
  | { ok: false; status: "unavailable"; reason: string };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Host names a valid token may have been issued for (apex and www). */
function expectedHostnames(): string[] | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  // Preview deployments run on generated hosts; only production pins the host.
  if (!raw || process.env.VERCEL_ENV === "preview") return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return [host, `www.${host}`];
  } catch {
    return null;
  }
}

/**
 * Server-side Turnstile verification. Rendering the widget proves nothing;
 * only this call does.
 *
 * - Production never skips: `TURNSTILE_SKIP` is honoured only outside
 *   production, and a missing secret is a configuration error ("unavailable").
 * - Cloudflare is called with a timeout; network failure is "unavailable",
 *   never an exception, so a Cloudflare outage cannot take lead capture down.
 * - The token's hostname must match the site (tokens minted elsewhere fail).
 */
export async function verifyTurnstile(token?: string, ip?: string): Promise<TurnstileResult> {
  // `TURNSTILE_SECRET_KEY` is the documented name (.env.example); the legacy
  // `TURNSTILE_SECRET` is still honoured.
  const secret = env.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET;

  // Outside production, forms work without Cloudflare keys (or with
  // TURNSTILE_SKIP=true); production never skips.
  if (!isProduction() && (!secret || env.TURNSTILE_SKIP === "true")) {
    return { ok: true, status: "skipped" };
  }

  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set in production; public forms cannot be verified.");
    return { ok: false, status: "unavailable", reason: "not_configured" };
  }

  if (!token || token.length > 2048) {
    return { ok: false, status: "failed", reason: "missing_token" };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip && ip !== "0.0.0.0") body.append("remoteip", ip);

  let payload: { success?: boolean; hostname?: string; "error-codes"?: string[] };
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, status: "unavailable", reason: `http_${response.status}` };
    }
    payload = await response.json();
  } catch (err) {
    const reason = err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network";
    console.error(`[turnstile] siteverify ${reason}:`, err instanceof Error ? err.message : err);
    return { ok: false, status: "unavailable", reason };
  }

  if (payload.success !== true) {
    const codes = payload["error-codes"] ?? [];
    // A bad secret is our fault, not the visitor's.
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
      console.error("[turnstile] secret rejected by Cloudflare:", codes.join(","));
      return { ok: false, status: "unavailable", reason: "invalid_secret" };
    }
    return { ok: false, status: "failed", reason: codes[0] ?? "rejected" };
  }

  const hosts = expectedHostnames();
  if (hosts && payload.hostname && !hosts.includes(payload.hostname)) {
    return { ok: false, status: "failed", reason: "hostname_mismatch" };
  }

  return { ok: true, status: "verified" };
}
