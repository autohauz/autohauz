import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Google Analytics is opt-in (NEXT_PUBLIC_GA_MEASUREMENT_ID). Its hosts are only
// admitted to the CSP when it is configured, so an unconfigured site does not
// carry a standing exception for a third party it never contacts.
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const gaScriptHosts = gaEnabled ? " https://www.googletagmanager.com" : "";
const gaConnectHosts = gaEnabled ? " https://www.google-analytics.com https://analytics.google.com" : "";

// Supabase project host — the only remote image origin the app needs (vehicle
// photos in the public `media` bucket). Derived from the URL so nothing else
// can be hot-linked through next/image.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com${gaScriptHosts};`
  : `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${gaScriptHosts};`;

const nextConfig: NextConfig = {
  // Remove "X-Powered-By: Next.js" from every response — reduces attack surface
  // by not advertising the framework to automated scanners.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb", // WARNING: Vercel hard-limits request bodies to 4.5MB on all plans
    },
  },
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    // Next.js image optimisation disabled to bypass Vercel WAF limits
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    // 30-day cache — vehicle photos are immutable once uploaded.
    minimumCacheTTL: 2592000,
    // Breakpoints tuned for car marketplace UI:
    //   640 → mobile card, 828 → medium card, 1080 → tablet card / hero,
    //   1200 → desktop card / detail thumb, 1920 → full-bleed VDP gallery
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [256, 384, 512],
    // Only the Supabase storage host (vehicle photos). Never a wildcard: with
    // `unoptimized: true` the pattern list is still the allow-list for
    // <Image src> on remote origins.
    remotePatterns: supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : [],
  },
  async headers() {
    return [
      // ── Global security headers (all routes) ────────────────────────────────
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co${gaConnectHosts}; frame-src https://challenges.cloudflare.com https://maps.google.com https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;`,
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Cross-Origin isolation — blocks Spectre/side-channel attacks and
          // prevents other origins from reading our responses.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
      },
      // ── Non-public paths: instruct crawlers to never index ──────────────────
      // Belt-and-suspenders alongside robots.txt — search engines honour both.
      {
        source: "/api/:path*",
        headers: [
          // API responses should never be cached by a shared proxy or CDN edge
          // unless the route explicitly opts in with Cache-Control.
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // ── Geo-restriction landing page ────────────────────────────────────────
      // Middleware rewrites out-of-region page requests here and already sets
      // these headers on the rewritten response. Repeating them at the route
      // level covers direct navigation to /geo-blocked, so the page can never
      // be indexed or cached by a shared proxy under any access path.
      {
        source: "/geo-blocked",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
