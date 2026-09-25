/**
 * Content-Security-Policy builder — one definition for both policies:
 *
 *  - PUBLIC (static/ISR pages, set in next.config.ts headers()):
 *    `script-src 'self' 'unsafe-inline'`. A nonce needs a per-request render,
 *    and making every public page dynamic would give up ISR for the whole
 *    marketing site. Residual risk is accepted and documented in
 *    AUTOHAUZ_SECURITY_AUDIT.md; known injection sinks are escaped at source.
 *
 *  - STAFF (/admin, /auth — already dynamic, and where a script injection
 *    would ride a privileged session): a fresh nonce per request plus
 *    'strict-dynamic', no 'unsafe-inline' for scripts. Set by src/proxy.ts.
 *
 * Style attributes remain 'unsafe-inline' in both: React `style={}` and the
 * toast library emit inline styles that nonces cannot cover, and CSS injection
 * is a far smaller risk than script injection.
 *
 * Pure (no Node/Next imports) so next.config.ts, the edge proxy and tests can
 * all use it.
 */

export type CspOptions = {
  isDev: boolean;
  /** Supabase project origin, e.g. https://abc.supabase.co */
  supabaseOrigin?: string;
  /** Whether Google Analytics is configured. */
  analytics?: boolean;
  /** Per-request nonce → strict staff policy. */
  nonce?: string;
};

export function buildCsp({ isDev, supabaseOrigin, analytics = false, nonce }: CspOptions): string {
  const supabase = supabaseOrigin ?? "https://*.supabase.co";
  const turnstile = "https://challenges.cloudflare.com";
  const ga = analytics ? ["https://www.googletagmanager.com"] : [];
  const gaConnect = analytics ? ["https://www.google-analytics.com", "https://analytics.google.com"] : [];

  const script = nonce
    ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]
    : ["'self'", "'unsafe-inline'", turnstile, ...ga];
  // Next dev (React Refresh) needs eval; production never gets it.
  if (isDev) script.push("'unsafe-eval'");

  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", script],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", supabase]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", ["'self'", supabase, ...(isDev ? ["ws:"] : []), ...gaConnect]],
    ["frame-src", nonce ? ["'none'"] : [turnstile, "https://maps.google.com", "https://www.google.com"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
  return isDev ? `${policy};` : `${policy}; upgrade-insecure-requests;`;
}

/** 128-bit random nonce, base64 — Web Crypto so it runs in the edge proxy. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Paths that receive the strict nonce policy (all dynamically rendered). */
export function isStaffPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin-login" ||
    pathname.startsWith("/auth/")
  );
}
