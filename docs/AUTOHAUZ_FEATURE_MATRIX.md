# AutoHauz — Feature Matrix

"Works" means verified by the method in the last column, not "the UI exists". Evidence levels:

- **R** runtime — exercised in a production build (`next start`) through the browser or HTTP.
- **T** automated tests (unit / integration / PGlite database).
- **S** source review only.
- **—** not verified.

Status: PASS · PARTIAL · FAIL · NOT VERIFIED · BLOCKED. Admin screens could not be rendered at runtime (no staff credentials were available to the engineer), so their evidence is T + S.

## Public website

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Homepage (hero search, featured cars, body types, guides, FAQ, newsletter) | PASS | R, Lighthouse 100/100/100 | Fabricated reviews removed; content in server HTML |
| Inventory listing + filters, sort, pagination, facet counts | PASS | R, T (pagination, sort) | Facets capped at 1000 rows (DB-28, accepted) |
| Make / model / body / budget landing pages | PASS | R | Thin-page guard → noindex; unknown bands 404 |
| Vehicle page (gallery, specs, price, Enquire / Call / WhatsApp, finance estimate, similar cars) | PASS | R, Lighthouse 100/100/100 | Wrong prefix → 308; malformed slug fixed (DB-31) |
| Vehicle enquiry / inspection / finance / sell / trade-in / contact forms | PARTIAL | R (validation, consent error), T (route) | End-to-end submission into the live DB **not run** (no production writes); Turnstile production keys not tested |
| Newsletter signup (double opt-in) | PARTIAL | T (route, tokens, DB RPCs) | Needs migrations 0024 + `…100200`; confirmation email not sent in test |
| Unsubscribe (link + RFC 8058 one-click) | PARTIAL | T | Same dependency |
| Blog hub / article / category | PARTIAL | R (empty state, 404s), T (sanitiser) | 0 published articles, so article rendering verified only by tests and source |
| Testimonials | PASS | R | `noindex` while empty |
| Legal pages, About, How it works, FAQs | PASS | R | Owner to confirm business claims (see SEO audit) |
| Contact page (details from Settings, click-to-load map) | PASS | R | |
| WhatsApp float | PASS | R | Hidden on vehicle pages, admin and auth |
| Geo restriction (AU + IN) | PASS | T (geo-restriction tests) | Production header trust (`GEO_TRUST_PROXY_HEADERS`) must match the platform |
| robots / sitemap / manifest / llms.txt | PASS | R | |
| Mobile navigation | PASS | R (keyboard + focus return) | Code-split |

## Staff back office (DMS / CRM / CMS)

| Feature | Status | Evidence | Notes |
|---|---|---|---|
| Sign-in (email/password, Google), MFA (TOTP) | PARTIAL | R (sign-in page, redirects), T (permission gate) | A real sign-in + MFA enrolment flow **NOT VERIFIED** (no credentials) |
| Role-based access (owner/admin/manager/sales/content) | PASS | T (30+ permission tests, gate tests), R (signed-out → sign-in; forged RSC → 307) | Role-granular RLS still open (SEC-09) |
| Role management (grant/revoke, pending invites, last-owner guard) | PARTIAL | T, S | DB guard trigger not deployed |
| Dashboard metrics | PARTIAL | S, T (reader guarded) | Real counts replace fake numbers; not rendered at runtime |
| Inventory list / create / edit / status / delete | PARTIAL | T (update, status rules, images), S | Vehicle save still multi-step (DB-09) |
| Bulk upload (CSV/XLSX + images) | PARTIAL | T (image handling, permission) | Invents defaults for missing fields (DB-29) |
| Catalogue (makes/models/features) | PARTIAL | S | Not audited in the activity log |
| Syndication feeds / channel settings | PARTIAL | S | Feeds `private, max-age=300`; push crons unscheduled |
| Leads (list, detail, status, notes, spam, delete) | PARTIAL | S, T (search sanitiser) | No DB-level transition rules; no pagination beyond the cap (DB-14) |
| Invoices (draft, issue, per-line GST, payments, void, email) | PARTIAL | T (12 DB tests, calc, document view-model) | Needs `…100100` migration; admin UI not rendered at runtime |
| Invoice PDF | PASS | T (render smoke tests: valid PDF, multi-page pagination, draft), visual check of generated PDF | Route itself (`/api/v1/invoices/[id]/pdf`) NOT VERIFIED at runtime |
| Blog CMS (editor, uploads, scheduling, SEO fields) | PARTIAL | T (sanitiser, validation), S | Editor not exercised in a browser |
| Email marketing (templates/blocks, segments, contacts, campaigns, schedule, send queue, test send) | PARTIAL | T (8 DB tests, blocks renderer, tokens) | Needs 0024 + `…100200`; SMTP delivery **NOT VERIFIED** |
| Campaign cron | PARTIAL | S, T (secret compare) | Scheduled once daily at 21:00 UTC (07:00–08:00 Sydney); a scheduled send waits for the next run |
| FAQs / testimonials admin | PARTIAL | S | Changes not audited |
| Settings (business profile, hours, phones, invoice/bank details) | PARTIAL | S | Single source for footer/contact/JSON-LD/invoices; not audited |
| Audit log | PARTIAL | T (append-only trigger) | Coverage incomplete (SEC-20) |

## Integrations

| Integration | Status | Notes |
|---|---|---|
| Supabase Auth / DB / Storage | PARTIAL | Read paths verified at runtime against the configured project; writes not exercised (production) |
| SMTP (nodemailer) | NOT VERIFIED | No test send performed |
| Cloudflare Turnstile | PARTIAL | Client widget renders on form pages; server verification unit-tested; production keys not tested |
| Redis rate limiting | PARTIAL | Timeouts + fallback reviewed; not load-tested |
| Meta lead ads webhook | BLOCKED | DB-04 must be fixed before enabling |
| TikTok / Google feeds / syndication push | NOT VERIFIED | Unscheduled |
| Vercel Analytics / Speed Insights / GA | PASS | Loaded only when configured |
