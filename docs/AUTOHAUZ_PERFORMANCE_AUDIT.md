# AutoHauz — Performance Audit

Measured against local production builds (`next build` + `next start`). No field data (CrUX / Speed Insights) was available to this audit; Vercel Speed Insights is wired and will collect it in production.

## Budgets

| Metric | Budget |
|---|---|
| LCP (mobile p75) | ≤ 2.5 s |
| CLS | ≤ 0.1 |
| INP | ≤ 200 ms |
| First-load JS, public routes (modern browsers, gzip) | ≤ 200 KB |
| CSS (gzip) | ≤ 25 KB |
| Preloaded fonts | 1 file |
| LCP image | ≤ 150 KB, width-matched |
| Images before scroll | ≤ 400 KB (`/`), ≤ 600 KB (`/used-cars`) |
| Uncached public render: DB round trips | ≤ 3 |
| Admin navigation TTFB | ≤ 600 ms |

## Changes

| ID | Change | Effect |
|---|---|---|
| PERF-01 | Pre-encoded responsive WebP (640/1080/1600 px heroes; 320/640 px body-type tiles) via `scripts/build-responsive-images.mjs` + `<ResponsiveImage srcset>` | Homepage hero 593 KB JPEG → 12–38 KB depending on viewport; finance/sell heroes 714/673 KB → 20–49 KB; body tiles 53–97 KB → 4–30 KB |
| PERF-01 | Header logo: 100 KB PNG preloaded at high priority → 30 KB WebP, eager, not preloaded | Removes contention with the LCP image |
| PERF-03 | framer-motion removed (5 homepage sections → server components, no reveal animation) and the dependency uninstalled | ~48 KB gzip JS less on `/`; content visible in server HTML (previously `opacity:0` until hydration); reduced-motion respected by construction |
| PERF-05 | `generateStaticParams() → []` on vehicle and blog pages (on-demand ISR); `getSimilarVehicles` cached | VDP and articles rendered once per revalidate window instead of per request |
| PERF-04 | Listing page query and facet query run in parallel; `getAllModels` cached | One fewer sequential DB round trip per listing render |
| PERF-06 | Blog HTML sanitised at save time; the editor no longer sanitises per keystroke | Less admin CPU; server render sanitises once per ISR window |
| PERF-07 | Proxy `getUser()` result now used (redirect) and admin role/MFA lookups collapsed to one query per request | Fewer auth round trips per admin request |
| PERF-09 | Google Maps iframe removed from the footer of every public page (directions link instead; `/contact` keeps the map) | ~1 MB third-party JS avoided on scroll |
| PERF-10 | Sonner toast library removed from public pages (admin-only) and the duplicate admin toaster fixed | ~16 KB gzip less on public routes |
| PERF-12 | Redis: 2 s connect / 0.8 s command timeouts, offline queue off, in-memory fallback on error | A Redis outage can no longer stall lead submission |
| PERF-14 | Proxy matcher skips `.ico/.avif/.woff2/.txt/.xml/.webmanifest/.csv` | Static files skip bot/geo/auth work |
| PERF-16 | TipTap duplicate Link/Underline/Strike registration removed | Removes duplicate-extension work/warnings in the admin editor |
| NEXT-02 | Server Action body limit 8 MB → 1 MB (no action takes files) | Smaller attack surface |
| deps | `sharp` → devDependency (build script only); framer-motion removed | Smaller production install |
| PERF-17 | Mobile navigation sheet (Base UI Dialog) code-split: the header renders a plain button; the sheet is prefetched on hover/focus and mounted on first tap | First-load JS −20…24 KB gzip on every public page (`/` 254 → 230 KB). Behaviour verified: focus trap, Escape, focus return, `aria-expanded` |
| PERF-18 | `/contact` Google Map is click-to-load; the hard-coded short link replaced by a search URL built from the Settings address | No Google requests or third-party cookies on page load (Lighthouse Best Practices 77 → 100 on `/contact`) |
| PERF-19 | Listing LCP image: `next/image` `priority` (deprecated in Next 16) → `preload` + `fetchPriority="high"`; homepage featured cards no longer preload (they competed with the hero) | Lighthouse "LCP request discovery" check now passes on `/used-cars` |

## Measured (2026-09-25, local production build on the owner's Windows machine, `next start`)

**Lab traces** — Chrome, 412×915 mobile, 4× CPU slowdown, DevTools "Slow 4G" (~560 ms added latency per request). Single runs; expect ±300 ms run-to-run variance. Local server, so TTFB excludes Vercel/CDN distance but includes live Supabase queries for dynamic routes.

| Route | LCP | CLS | LCP element | Notes |
|---|---|---|---|---|
| `/` | 1.34 s | 0.00 | hero WebP (1080 w, preloaded with `imagesrcset`, `fetchpriority=high`) | Unthrottled: 453 ms |
| `/used-cars` | 1.6–1.9 s | 0.02 | first card image (placeholder SVG today) | Dynamic route: TTFB 316–751 ms (Supabase round trips) |

Budgets met in lab: LCP ≤ 2.5 s, CLS ≤ 0.1. **INP: NOT VERIFIED** (needs field data). **Field Core Web Vitals: NOT VERIFIED** — no CrUX data; Vercel Speed Insights will report after launch.

**First-load JavaScript** (modern browsers, gzip, measured by gzipping every `/_next/static` script referenced by the HTML):

| Route | JS | CSS |
|---|---|---|
| `/` | 230 KB | 22 KB |
| `/used-cars` | 257 KB | 22 KB |
| vehicle page | 265 KB | 22 KB |
| `/contact` | 239 KB | 22 KB |
| `/finance` | 241 KB | 22 KB |
| `/blog`, `/about` | 220–224 KB | 22 KB |

**Budget ≤ 200 KB: FAIL** (by 20–65 KB). Composition on `/`: React DOM 69 KB + Next runtime 67 KB (fixed cost, 136 KB) · Base UI 33 KB (button/input primitives, listing filter sheet, VDP dialogs) · app code 45 KB · tailwind-merge 8 KB · Vercel analytics 7 KB. Next reductions, in order of value: replace the Base UI `Button`/`Input` wrappers on public pages with plain elements (they only add styling hooks), lazy-load the listing filter sheet and VDP dialogs as done for the mobile menu, and drop `tailwind-merge` from public components that don't merge conflicting classes.

**Lighthouse 13.4.1 (mobile form factor)**: Accessibility / Best Practices / SEO = 100 / 100 / 100 with 0 failed audits on `/`, `/used-cars`, a vehicle page, `/finance`, `/sell-your-car`, `/contact`. The Performance category was not part of this tool's run — the traces above are the performance evidence.

**Fonts**: one preloaded file (Archivo variable, 88 KB). CSS 22 KB gzip (budget 25 KB: PASS).

## Accepted / open

- **Font (PERF-11) — ACCEPTED pending owner decision**: Archivo variable font with the width axis (~90 KB, `display: swap`) is a deliberate brand choice (wide headings echo the wordmark). Dropping the axis saves ~60 KB.
- **Vehicle photos (PERF-02) — OPEN**: listing cards download up-to-1920 px uploads. Needs upload-time variants or Supabase image transforms (paid feature) before stock grows.
- **Facets (DB-28) — ACCEPTED**: counted from ≤1000 rows (PostgREST cap); GROUP BY RPC needed past ~1000 live cars.
- **Image optimiser** stays disabled (deliberate, cost/WAF reasons in `next.config.ts`); static assets are pre-optimised instead.
- **`/finance`, `/trade-in` dynamic (PERF-08) — OPEN**: an optional `?vehicle=` prefill forces dynamic rendering.
- **Lighthouse**: see `AUTOHAUZ_FINAL_QA_REPORT.md` for the measured run.
