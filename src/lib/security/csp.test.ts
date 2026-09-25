import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce, isStaffPath } from "./csp";

const directive = (csp: string, name: string) =>
  csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("buildCsp", () => {
  it("staff policy: nonce + strict-dynamic, no unsafe-inline/eval scripts, no frames", () => {
    const csp = buildCsp({ isDev: false, nonce: "abc123", supabaseOrigin: "https://x.supabase.co" });
    const script = directive(csp, "script-src");
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("public policy: Turnstile allowed, GA only when configured, never eval in production", () => {
    const off = buildCsp({ isDev: false });
    expect(directive(off, "script-src")).toContain("https://challenges.cloudflare.com");
    expect(off).not.toContain("googletagmanager");
    expect(off).not.toContain("unsafe-eval");
    expect(off).not.toContain("fonts.googleapis.com");
    const on = buildCsp({ isDev: false, analytics: true });
    expect(directive(on, "script-src")).toContain("https://www.googletagmanager.com");
    expect(directive(on, "connect-src")).toContain("https://www.google-analytics.com");
  });

  it("scopes Supabase to the project origin when known", () => {
    const csp = buildCsp({ isDev: false, supabaseOrigin: "https://abc.supabase.co" });
    expect(directive(csp, "connect-src")).toContain("https://abc.supabase.co");
    expect(csp).not.toContain("*.supabase.co");
  });

  it("allows eval only in development", () => {
    expect(directive(buildCsp({ isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });
});

describe("generateNonce", () => {
  it("is unique base64 of 16 bytes", () => {
    const a = generateNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(generateNonce()).not.toBe(a);
  });
});

describe("isStaffPath", () => {
  it("matches staff routes only", () => {
    for (const p of ["/admin", "/admin/leads", "/admin-login", "/auth/sign-in", "/auth/mfa"]) expect(isStaffPath(p)).toBe(true);
    for (const p of ["/", "/about", "/administrator", "/authors", "/used-cars"]) expect(isStaffPath(p)).toBe(false);
  });
});
