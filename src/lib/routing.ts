const DEFAULT_ADMIN_PATH = "/admin";

// Any ASCII control character (incl. TAB/CR/LF, which URL parsers strip) or a
// backslash (which WHATWG parsers treat as "/") can turn "/…" into "//host".
const UNSAFE_REDIRECT_CHARS = /[\u0000-\u001f\u007f\\]/;

/**
 * Validates that a redirect target is a same-origin relative path.
 *
 * String prefix checks alone are bypassable (`/\t/evil.com` resolves to
 * `https://evil.com/`), so the candidate is also resolved against a fixed
 * origin and must stay on it.
 */
export function isSafeRedirectPath(next: string): boolean {
  if (!next.startsWith("/") || next.startsWith("//")) return false;
  if (UNSAFE_REDIRECT_CHARS.test(next)) return false;
  if (next.includes(":")) return false;
  try {
    const base = "https://redirect.invalid";
    return new URL(next, base).origin === base;
  } catch {
    return false;
  }
}

/** The staff admin panel — the only authenticated zone on the site. */
export function isAdminZone(path: string): boolean {
  return path === DEFAULT_ADMIN_PATH || path.startsWith(`${DEFAULT_ADMIN_PATH}/`);
}

/**
 * Post-sign-in destination. Only staff authenticate, so the only legitimate
 * targets are admin pages; anything else (external, `javascript:`, malformed)
 * falls back to the dashboard.
 */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next || !isSafeRedirectPath(next)) return DEFAULT_ADMIN_PATH;
  const pathname = next.split(/[?#]/, 1)[0];
  return isAdminZone(pathname) ? next : DEFAULT_ADMIN_PATH;
}

/**
 * Dynamic route params arrive percent-encoded (a space is `%20`), while the
 * database stores the decoded value. Malformed escapes fall back to the raw
 * segment, which then simply fails the lookup.
 */
export function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
