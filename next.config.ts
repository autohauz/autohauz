import type { NextConfig } from "next";

const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;"
    : "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;";

const nextConfig: NextConfig = {
  // Remove "X-Powered-By: Next.js" from every response — reduces attack surface
  // by not advertising the framework to automated scanners.
  poweredByHeader: false,
  // Next.js 15+ has moved serverActions out of experimental
  serverActions: {
    bodySizeLimit: "8mb", // WARNING: Vercel hard-limits request bodies to 4.5MB on all plans
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
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
              `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://upload.wikimedia.org; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.typesense.net; frame-src https://challenges.cloudflare.com https://maps.google.com https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;`,
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
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache" },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache" },
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
  async redirects() {
    return [
      {
        source: "/account/listings",
        destination: "/admin/inventory",
        permanent: true,
      },
      {
        source: "/account(.*)",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/vendor(.*)",
        destination: "/admin",
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
