# AutoHauz — Final QA Report

**Date:** 2026-09-25 · **Build under test:** working tree of the AutoHauz app on `main` (base `74de6a8` plus uncommitted remediation), `next build` + `next start` on port 3100 (Windows, local) · **Database:** configured Supabase project, read paths only; the four new migrations were verified in PGlite and have **not** been applied.

**Statuses:** PASS · PARTIAL · FAIL · NOT VERIFIED · BLOCKED.

## Verdict

**Not production-ready until the deployment preconditions (below) are done.** The code is in a releasable state:
- 335/335 tests pass.
- Type-check and lint are clean.
- The production build compiles.
- Lighthouse scores 100/100/100 on the key public pages.
- No known P0/P1 code defect remains open.

Three things block release:
1. **Exposed credentials** must be rotated.
2. **Four migrations** must be applied. Invoices, email marketing and newsletter signup depend on them.
3. **The staff back office and outbound email have not been exercised end to end with a real account.**

## Deployment preconditions (in order)

1. **Rotate** the Supabase service-role key, the admin password and the Supabase management (`sbp_`) token (SEC-00). Then delete `scratch/create-admin.mjs`, `scratch/login.js`, `scratch/push-sql.js` and `scratch/create-audit-docs.js`.
2. **Confirm migration state** with `supabase migration list`. Then apply, in order:
   1. `0024_email_marketing`
   2. `20260924100000_security_hardening`
   3. `20260924100100_invoice_integrity`
   4. `20260924100200_email_delivery`
   5. `20260924100300_vehicle_slug_hygiene`

   Take a backup first. The migrations are additive or idempotent, but they have been tested only against PGlite.
3. **Set production env:**
   - `EMAIL_TOKEN_SECRET` (≥ 32 random characters)
   - `CRON_SECRET`
   - `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `REDIS_URL`
   - `IP_HASH_SECRET`
   - the SMTP variables
   - `NEXT_PUBLIC_APP_URL` set to the canonical https origin

   Make sure `TURNSTILE_SKIP` is unset.
4. **Grant roles.** Create `admin_roles` rows for the real staff (today only the env allowlist grants access), sign in, and enrol MFA.
5. **Owner confirmations:**
   - Replace the Unsplash-sourced vehicle photos, which currently render as placeholders.
   - Confirm the `jashire.com.au` contact email.
   - Confirm the business claims flagged in the SEO audit: inspection/reconditioning, licence number, credit-licence disclosure.
   - Decide on the Archivo width-axis font trade-off.
6. **After deploy:** run the post-deploy checks at the end of this report.

## Security

| Item | Status | Evidence |
|---|---|---|
| Secrets | PARTIAL | History clean (owner rewrite, verified), `.env*` ignored, no secrets in the source tree. **Rotation outstanding** (SEC-00). |
| Authentication | PARTIAL | Signed-out `/admin/*` → 307 to sign-in (runtime); `getUser()` everywhere; MFA enforced when enrolled or required (tests). A real sign-in + MFA flow was **NOT VERIFIED** (no credentials). |
| Authorization | PASS | `requirePermission` in every admin page, action, reader and route (source + 12 gate tests + 10 policy tests); forged RSC request → 307; owner-escalation and self-change blocked in app (tests). |
| RLS / database grants | PARTIAL | Definer-RPC lockdown, profile identity lock, owner guard, append-only audit log, retired-table writes revoked: **tested in PGlite, not deployed**. Role-granular RLS per table is OPEN (SEC-09). |
| Storage | PARTIAL | Vehicle image keys restricted to `vehicles/…`; blog uploads use random keys and a type allow-list. Bucket policies were not re-audited live. |
| Uploads | PARTIAL | Bulk upload is permission-gated and tested for image handling. It still invents defaults for missing fields (DB-29). |
| Headers | PASS | HSTS preload, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP/CORP (runtime); `X-Robots-Tag: noindex` on admin, api and auth. |
| CSP | PARTIAL | Staff: nonce + `'strict-dynamic'`, verified with no violations. Public: static policy still includes `'unsafe-inline'` scripts (accepted trade-off for ISR). |
| Cookies | PARTIAL | No third-party cookies on public page load (contact map now click-to-load; Lighthouse Best Practices 100). Supabase SSR auth cookies are SameSite=Lax but **readable by JavaScript** by `@supabase/ssr` design, so XSS protection (nonce CSP on staff pages, sanitisers) is what guards staff sessions. Cookie flags on the production domain: NOT VERIFIED. |
| Rate limits | PARTIAL | Leads, newsletter, CTA and views limited; Redis timeouts and fallback reviewed. Not load-tested; login relies on Supabase Auth limits. |
| Webhooks / cron | PARTIAL | Cron secrets use constant-time compare and fail closed; Meta verify token uses constant-time compare. The Meta ingest upsert is broken (DB-04, integration **BLOCKED** until fixed). |
| Open redirect / XSS / injection | PASS | Tests plus runtime checks on redirect params; JSON-LD escaping has a source guard; server-side HTML sanitiser; search-term sanitiser; malformed paths → 400. |

## Performance

| Item | Status | Evidence |
|---|---|---|
| Bundle / JS | FAIL (budget) | 220–265 KB gzip first-load JS against a 200 KB budget. It was 247–267 KB before the mobile-menu split. 136 KB of it is fixed framework cost. The next steps are listed in the performance audit. |
| Images | PASS | Responsive WebP heroes (12–49 KB), LCP image preloaded with `fetchpriority=high`. Vehicle photos still need upload-time variants (PERF-02, OPEN). |
| Fonts | PASS | One self-hosted variable font, preloaded, `swap`. |
| CSS | PASS | 22 KB gzip (budget 25 KB). |
| Caching | PASS | ISR / on-demand ISR for public routes; tag invalidation from actions and routes; admin `no-store`. |
| API latency | NOT VERIFIED | Not load-tested; `/used-cars` TTFB of 316–751 ms locally includes Supabase round trips over the internet. |
| Database | PARTIAL | Parallel listing queries, cached readers; facets capped at 1000 rows (accepted). |
| Third-party scripts | PASS | No Google requests on page load; Turnstile only on form pages; analytics only when configured. |
| Core Web Vitals (lab) | PASS | 4× CPU + Slow 4G: `/` LCP 1.34 s, CLS 0.00; `/used-cars` LCP 1.6–1.9 s, CLS 0.02. |
| Core Web Vitals (field) | NOT VERIFIED | No CrUX data; Speed Insights will collect it after launch. |
| Lighthouse | PASS | 13.4.1 mobile: 100/100/100 (A11y/BP/SEO), 0 failed audits on `/`, `/used-cars`, a vehicle page, `/finance`, `/sell-your-car`, `/contact`. |

## Head / SEO

| Item | Status | Evidence |
|---|---|---|
| Metadata | PASS | Unique titles through the template (brand once), one description, OG/Twitter from one builder (runtime + Lighthouse). |
| Noindex | PASS | Facets, sold cars, thin landings, thank-you, newsletter, empty testimonials, admin/auth/api and preview deployments. |
| robots.txt | PASS | Crawl policy only; AI training bots refused, AI search bots allowed. |
| Canonical | PASS | Absolute self-canonicals; no root canonical inheritance. |
| Sitemap | PASS | Indexable URLs only, real `lastModified`, URLs percent-encoded (the space-in-slug bug is fixed). |
| Structured data | PASS | `Car` + `Offer`, `BreadcrumbList`, `CollectionPage`, `Article`, site graph; fabricated or incorrect properties removed. Google Rich Results Test against the live URL: **NOT VERIFIED**. |
| Redirects | PASS | Wrong VDP prefix → 308; `people_mover` → 308; `/search` → 308 keeping params; DB redirect rules consulted before 404. |
| Duplicate URLs | PASS | See redirects. https/www canonical host on the production domain: **NOT VERIFIED**. |

## Accessibility

| Item | Status | Evidence |
|---|---|---|
| WCAG-oriented findings | PASS (automated) / NOT VERIFIED (AT) | Lighthouse 100 on six routes. No screen-reader session was performed. |
| Keyboard | PARTIAL | Mobile menu (focus trap, Escape, focus return), sortable headers as buttons, gallery keys, ConfirmDialog focus trap. The admin was not walked through at runtime. |
| Focus | PASS | Global `:focus-visible` ring; admin inputs no longer suppress it (A11Y-08). |
| Labels | PASS | All admin controls named or labelled, including the roles fieldset, row status select and editor toolbar (source). |
| Contrast | PASS | Token pairs computed ≥ 4.5:1 for text; the navy/black badge defect fixed. |
| Forms | PARTIAL | Errors announced; finance consent error linked (runtime); server errors name the fields but map to one message on forms other than finance. |
| Motion | PASS | No scroll or reveal animation; reduced motion honoured. |

## Product

| Item | Status | Evidence |
|---|---|---|
| Inventory (public) | PASS | Listing, filters, landings and vehicle pages at runtime; slug bug fixed. |
| Inventory (admin) | PARTIAL | Status rules and update tested; admin UI not rendered; vehicle save not transactional (DB-09). |
| Vehicles (VDP) | PASS | Runtime at 390, 768 and 1920 px; Call/WhatsApp/Enquire present; phone formatted. |
| Leads | PARTIAL | Public forms validate at runtime; submission into the DB not executed (production data); admin CRM by source review only. |
| Invoices | PARTIAL | 12 DB tests, calculation and view-model tests, PDF render tests plus visual check. **Needs migration**; admin UI and PDF route not exercised at runtime. |
| CMS / blog | PARTIAL | Sanitiser and validation tests, public 404 and empty states at runtime; editor not exercised in a browser. |
| Email marketing | PARTIAL | 8 DB tests, block renderer and token tests. **Needs migrations**; SMTP delivery NOT VERIFIED. |
| Settings | PARTIAL | Single business-profile source verified on public pages (footer, contact, VDP phones); the admin form was not exercised. |
| RBAC | PASS | Policy and gate tests; runtime redirects. |

## Testing

| Item | Status | Evidence |
|---|---|---|
| Unit | PASS | Included in 335 passing tests (44 files). |
| Integration | PASS | Permission gates, actions and routes with mocked Supabase; 38 PGlite database tests. |
| E2E | FAIL | No browser E2E suite exists (Playwright not installed). Journeys were checked manually and recorded here. |
| Security regression | PARTIAL | Automated: redirects, CSP builder, grants, sanitisers, source guards. Manual checklist in the test plan. |

## Changes made in the final QA pass (2026-09-25)

**Vehicle slug containing a space.**
- The listing and sitemap linked to that vehicle page, and it returned 404.
- Route params are now decoded, the sitemap encodes its URLs, and a migration fixes the data with a 301 and a CHECK constraint.

**Malformed URLs** now return 400 instead of 500.

**Contact page.**
- The map is click-to-load.
- The directions link is built from the address in Settings.

**Public performance and polish.**
- Mobile menu code-split, saving 20–24 KB JS per page.
- LCP `fetchpriority` fixed.
- Homepage cards no longer preload.
- Phone numbers display in Australian format.
- The WhatsApp float no longer covers the vehicle page Call button.
- The gallery placeholder overlap is fixed.
- Listing heading order and "Read more" link text fixed.

**Admin accessibility.**
- Focus rings, labels and the editor toolbar.
- ConfirmDialog for publish/unpublish and delete.
- Vehicle status rules (`published_at` and `sold_at`).
- The navy/black badge contrast defect fixed; minimum 12 px text.

**Forms and documents.**
- The lead API's field errors are turned into a readable message.
- The finance consent error is linked to its checkbox.
- Invoice PDF render tests added; invoice dates use `d MMM yyyy`.

## Post-deploy checks (must be done on the real environment)

1. Sign in as each role, enrol MFA, and confirm the navigation and access match `permissions.ts`.
2. Create a vehicle with real photos, publish it, and confirm the listing, vehicle page, sitemap and syndication feed.
3. Submit one enquiry of each type. Confirm the lead in the CRM and the staff notification email.
4. Create an invoice, then issue it, record a payment, download the PDF and email it. Void a test invoice.
5. Subscribe to the newsletter, confirm by email, send a test campaign, then unsubscribe with one click.
6. Check the https/www redirects and Search Console coverage, and run the Rich Results Test on a vehicle page.
7. Watch Speed Insights field LCP/INP/CLS for 28 days.

## Documentation set

The following are all in `docs/`:
- `AUTOHAUZ_AUDIT.md`
- `AUTOHAUZ_FEATURE_MATRIX.md`
- `AUTOHAUZ_SECURITY_AUDIT.md`
- `AUTOHAUZ_PERFORMANCE_AUDIT.md`
- `AUTOHAUZ_HEAD_SEO_AUDIT.md`
- `AUTOHAUZ_DATABASE_AUDIT.md`
- `AUTOHAUZ_ACCESSIBILITY_AUDIT.md`
- `AUTOHAUZ_DESIGN_AUDIT.md`
- `AUTOHAUZ_TEST_PLAN.md`
- `AUTOHAUZ_ARCHITECTURE.md`
- `AUTOHAUZ_FINAL_QA_REPORT.md`

`DESIGN.md` is at the project root.

External agent systems named in the master prompt were **REFERENCE-ONLY**: they were not installed or executed, and their rules were applied as checklists.
