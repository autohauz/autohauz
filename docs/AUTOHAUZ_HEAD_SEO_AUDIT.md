# AutoHauz — Head, Metadata, Crawl-Control & Australian SEO Audit

Scope: root and route metadata, `robots.ts`, `sitemap.ts`, `manifest.ts`, JSON-LD, proxy/header crawl controls, `public/llms.txt`, and on-page claims. Market: Australia only.

## Architecture (after remediation)

- **One metadata source per page**: `pageMetadata()` / `listingMetadata()` build title, description, self-canonical (absolute, from `NEXT_PUBLIC_APP_URL`), robots, Open Graph and Twitter together. The root layout sets `metadataBase`, the title template `%s | AutoHauz`, default OG image, icons and viewport — and deliberately **no** canonical (it would be inherited by every page).
- **Robots signals**: page `robots` metadata for noindex pages; `X-Robots-Tag: noindex, nofollow` header on `/admin`, `/api`, `/auth` and on every page of a Vercel **preview** deployment; `robots.txt` for crawl policy only (never access control).
- **Structured data**: site graph (Organization + WebSite + AutoDealer) on every public page; `Car` + `Offer` + BreadcrumbList on vehicle pages; CollectionPage/ItemList/BreadcrumbList on listings; `Article` on blog posts; `FAQPage` on `/faqs` only. All escaped against `</script>` injection (`serializeJsonLd`, enforced by a source-guard test).

## Head inventory & classification (changes made)

| Item | Where | Classification | Action |
|---|---|---|---|
| `<title>` with brand twice (`About AutoHauz \| AutoHauz`, blog `… \| AutoHauz \| AutoHauz`, unsubscribe pages) | about, contact, finance, sell-your-car, how-it-works, blog, newsletter | DUPLICATED | Brand left to the template |
| Blog titles/canonicals/links containing literal `${…}` | blog pages, cards, `lib/seo/blog.ts` | DANGEROUS (every post canonicalised to one non-existent URL; all links 404) | Fixed; source-guard test |
| `meta keywords` | 8 routes + builders | UNNECESSARY (ignored by Google) | Removed |
| Duplicate favicon links (`/favicon.ico` ×2 + file convention) | root layout | DUPLICATED | Removed explicit copies |
| `mobile-web-app-capable` without a manifest | root layout | CONFLICTING | Added `app/manifest.ts` |
| Admin pages inheriting root `index,follow` meta vs `noindex` header | admin layout | CONFLICTING | Admin metadata `noindex, nofollow` |
| `/offline` page (no service worker) with homepage metadata, indexable | `app/offline`, `public/offline.html` | OUTDATED / DUPLICATED | Deleted |
| Unsubscribe / confirm pages indexable | newsletter pages | UNNECESSARY index | `noindex` |
| `/testimonials` indexable while empty | testimonials | thin | `noindex` until a genuine review exists |
| Header logo preloaded at `fetchpriority=high` (100 KB PNG) | brand-logo | PERFORMANCE-COSTLY | 30 KB WebP, eager, not preloaded |
| Google Analytics | root layout, `lazyOnload`, only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` set | USEFUL | Kept |
| Vercel Analytics / Speed Insights | only when `VERCEL` set | USEFUL | Kept |
| Search Console verification | env only | REQUIRED when used | Kept |
| `theme-color`, viewport | root | REQUIRED | Kept (single declaration) |

## robots.txt (new policy)

- `*`: allow `/`; disallow `/admin`, `/admin/`, `/admin-login`, `/api/`, `/auth/`, `/geo-blocked`.
- **Removed**: `Disallow: /_next/` (blocked non-Google crawlers from rendering pages), `Disallow: /thank-you` (it is `noindex`; disallowing hides the noindex), `crawl-delay 10` (throttled AI-search crawlers too), Yandex-only `host`.
- AI **training** crawlers refused (owner policy): GPTBot, CCBot, anthropic-ai, ClaudeBot, Google-Extended, Applebot-Extended, Meta-ExternalAgent, Bytespider, cohere-ai, Omgilibot, PetalBot. AI **search** crawlers (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot/User) are allowed and are also exempt from the geo gate.
- Ahrefs/Semrush no longer blocked (robots or proxy) so the owner can audit the site; high-volume scrapers (MJ12, Dot, BLEX, DataForSeo, serpstat, Seobility) still refused.

## Sitemap (new rules)

Only canonical, indexable URLs: `/`, `/used-cars`, evergreen pages, available/reserved vehicles (with own-storage image entries only), make/model/body/budget landing pages **only when they pass the thin-page guard**, `/testimonials` only with approved reviews, blog hub/categories/articles only when published articles exist. `lastModified` is real (newest stock change / article update) or omitted — never invented.

## Canonicalisation & duplicates

| Case | Before | After |
|---|---|---|
| VDP with wrong make/model prefix | 200 (duplicate) | 308 → canonical path |
| `/used-cars/body/people_mover` | 200, self-canonical | 308 → `people-mover` |
| `/used-cars/under-12345` (any number) | 200, indexable | 404 unless a real budget band |
| `?status=sold` | indexable variant | facet → `noindex, follow`, canonical to hub |
| `/search?…` | 307, filters dropped | 308 with all parameters |
| `/faq`, `/success-stories`, `/legal/rules` | 308 redirects | kept |
| http→https, www↔apex | handled by Vercel domain config | **NOT VERIFIED** (production domain not tested) |
| Vehicle slug containing a space (DB-31) | listing link → 404; sitemap `<loc>` with a raw space | page 200 (param decoded), sitemap percent-encoded; migration moves it to a clean slug with a 301 |
| Malformed escapes in any path | 500 | 400 + `noindex` |

## Structured-data accuracy fixes

- Vehicle type `Vehicle` → `Car`.
- Removed the **masked VIN published as `vehicleIdentificationNumber`**, `productionDate` (was the model year), `mpn` (was the stock number), invented `priceValidUntil`.
- Removed the WebSite `SearchAction` (sitelinks search box retired by Google in 2024).
- `FAQPage` only on `/faqs` (was duplicated on the homepage).
- Blog `Article`: author is the named person or the business `Organization` (not a `Person` named after the brand); publisher logo points to a real file.
- No ratings or review counts anywhere unless entered in Settings; the homepage rating block now appears only with genuine figures.

## Route indexability policy

| Route | Policy |
|---|---|
| `/`, `/used-cars`, `/used-cars?page=N` | INDEX |
| `/used-cars/*` with facet/sort/`q`/`status` params | NOINDEX, follow; canonical → hub |
| `/used-cars/{make}`, `/{make}/{model}`, `/body/{type}`, `/under-{band}` | INDEX when stocked above the thin-page threshold, else NOINDEX |
| Vehicle page (available/reserved) | INDEX |
| Vehicle page (sold) | NOINDEX, follow |
| Vehicle page, wrong prefix | REDIRECT 308 |
| `/finance`, `/trade-in`, `/sell-your-car`, `/contact`, `/about`, `/how-it-works`, `/faqs`, `/legal/*` | INDEX |
| `/testimonials` | INDEX with reviews, else NOINDEX |
| `/blog`, `/blog/{slug}`, `/blog/category/{slug}` | INDEX (unknown → 404) |
| `/thank-you`, `/newsletter/*` | NOINDEX (crawlable) |
| `/admin*`, `/auth/*`, `/api/*`, `/geo-blocked` | DISALLOW + `X-Robots-Tag: noindex` (access controlled separately) |
| Vercel preview deployments | NOINDEX header |

## Australian SEO & content accuracy

- Locale `en-AU`, AUD, Australian Consumer Law framing.
- Claims needing owner confirmation (not changed — business facts): "every car is inspected / professionally reconditioned", "competitive rates", "licensed dealer" without a licence number, finance copy without credit-licence disclosure, the `jashire.com.au` contact email domain, the hard-coded Kings Park NSW address/phone fallbacks.
- Fixed: the About page's "the price you see is the absolute price you pay", which contradicted the site's own Terms (stamp duty/registration extra).
- AI visibility: business identity (name, ABN, address, phone, hours) now comes from one source (Admin → Settings) for the footer, contact page, JSON-LD and email; `llms.txt` is a convenience index, **not** a ranking mechanism.

## Measured (2026-09-25, local production build)

- Lighthouse 13.4.1 mobile **SEO 100, 0 failed audits** on `/`, `/used-cars`, a vehicle page, `/finance`, `/sell-your-car`, `/contact`.
- HTTP checks: VDP wrong prefix → 308; `/search?…` → 308 with parameters; unknown budget band → 404; `/used-cars/body/people_mover` → 308; test-seed → 404; malformed escape → 400; `/api/health` 200.
- `robots.txt`, `sitemap.xml` and `manifest.webmanifest` served and valid; sitemap contains only indexable URLs and every `<loc>` is a valid URL.
- **NOT VERIFIED**: the production domain (https/www redirects, Search Console coverage, rich-result eligibility in Google's Rich Results Test against the live URL).
