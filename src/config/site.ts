/**
 * Site identity — the values that are fixed for this deployment and safe to
 * ship in code. Anything the client may change later (address, ABN, phone,
 * hours, socials) lives in the `settings` table instead; see `config/business.ts`.
 */
export const site = {
  /** Brand name shown to customers. */
  brandName: "AutoHauz",
  /** Short descriptor used in titles/OG; no location or superlative claims. */
  tagline: "Quality used cars in Australia",
  /** Canonical production origin (no trailing slash). `NEXT_PUBLIC_APP_URL` overrides at runtime. */
  domain: "https://autohauz.com.au",
  locale: "en-AU",
  ogLocale: "en_AU",
  timezone: "Australia/Sydney",
  currency: "AUD",
  country: "Australia",
  countryCode: "AU",
  /** Brand asset paths (produced by scripts/brand/build-brand-assets.mjs). */
  assets: {
    logoPrimary: "/brand/logo-primary.png",
    logoDark: "/brand/logo-dark.png",
    mark: "/brand/mark.png",
    ogImage: "/brand/og-image.jpg",
    favicon: "/brand/favicon.ico",
    appleTouchIcon: "/brand/apple-touch-icon.png",
    icon192: "/brand/icon-192.png",
    icon512: "/brand/icon-512.png",
  },
  /** Brand colour used for `theme-color` and manifest — derived from the logo's navy. */
  themeColor: "#0B3573",
} as const;

export type SiteConfig = typeof site;
