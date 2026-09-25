# AutoHauz — Security Audit

Audit date: 2026-09-24 → 2026-09-25 (last updated 2026-09-25). Scope: the AutoHauz app (Next.js 16.2.6 App Router, React 19.2, Supabase SSR 0.10, Supabase Postgres).
Method: independent static audit of every Server Action, route handler, admin page, data function and migration; fixes implemented, then verified with unit tests, PGlite database tests (real Postgres semantics) and HTTP/browser checks against a production build (`next start`).

Status legend: **FIXED** (implemented and verified) · **FIXED — NOT DEPLOYED** (implemented and tested; requires migrations to be applied) · **PARTIAL** · **OPEN** · **ACCEPTED** (documented residual risk).

> ⚠️ Database fixes live in new migrations that have **not** been applied to the configured Supabase project. See "Deployment preconditions" at the end.

## Findings

| ID | Sev | Finding | Status | Fix / evidence |
|---|---|---|---|---|
| SEC-00 | P0 | Supabase **service-role secret, admin email and plaintext password** committed in local commit `08535fb` (`create_admin.js`, `update_admin.js`); Supabase **Management API token (`sbp_…`)** hard-coded in `scratch/push-sql.js` (untracked). | PARTIAL | Owner rewrote the unpushed commits (`74de6a8`, verified: no secrets in pushed history). The values existed on disk and in tool output → **rotate the service-role key, the admin password and the `sbp_` token.** Delete `scratch/push-sql.js`, `scratch/create-admin.mjs`, `scratch/login.js`. |
| SEC-01 | P0 | Every SECURITY DEFINER RPC (`anonymize_stale_leads`, `create_lead_with_event`, `next_invoice_number`, …) executable by `anon` via `/rest/v1/rpc/*` → anyone could wipe all lead PII with the public key. | FIXED — NOT DEPLOYED | `20260924100000_security_hardening.sql` revokes EXECUTE from public/anon/authenticated, grants service_role, private default privileges. Negative control proved the hole existed; `src/__tests__/db/migrations.test.ts` proves it is closed. |
| SEC-02 | P0 | `GET /api/v1/invoices/test-seed` — unauthenticated, wrote fake issued/paid invoices with the service role, burned invoice numbers. | FIXED | Route deleted; runtime: `404`. |
| SEC-03 | P1 | Admin auth relied on the layout alone (proxy redirect commented out "[DEMO MODE]"); 15 admin pages and the private data readers had no check → RSC layout-bypass could leak leads/invoices/bank details. | FIXED | Proxy redirect restored; `requirePermission()` in every admin page, Server Action, admin route handler and private data reader (`lib/data/{leads,invoices,dashboard,email-*}`), `import "server-only"`. Runtime: forged `RSC`/`Next-Router-State-Tree` request → `307` to sign-in. |
| SEC-04 | P1 | `?redirectedFrom=javascript:…` on staff sign-in → XSS / open redirect after login. | FIXED | `safeAdminRedirect()` (admin paths only). `src/lib/routing.test.ts`. |
| SEC-05 | P1 | `/auth/callback?next=/%09/evil.com` open redirect (tab bypass). | FIXED | URL-resolution check + control-char rejection. Runtime: → `/admin`. |
| SEC-06 | P1 | Stored XSS: blog JSON-LD rendered with raw `JSON.stringify`. | FIXED | `<JsonLd>` (escapes `<`,`>`,`&`); source-guard test forbids the pattern. |
| SEC-07 | P1 | Role grant matched `profiles.email`, which users can edit → role hijack. | FIXED (app) / FIXED — NOT DEPLOYED (DB trigger) | Accounts resolved via Auth admin API only; DB trigger pins `profiles.email/id` for user sessions (tested). |
| SEC-08 | P1 | Marketing unsubscribe link and `List-Unsubscribe` header were literal text (`\${…}`); no suppression; possible double sends (Spam Act 2003). | FIXED — NOT DEPLOYED | Signed HMAC tokens, RFC 8058 one-click endpoint, suppression list, queue with `UNIQUE(campaign,contact)`. Source-guard test forbids `\${`. |
| SEC-09 | P2 | RLS grants any staff role full access to invoices/email/blog tables. | PARTIAL | App enforces a role→permission map; DB now blocks admin→owner escalation and makes issued invoices immutable. Role-granular RLS for every table: **OPEN** (all app traffic uses the service role; RLS matters for direct PostgREST use by staff JWTs). |
| SEC-10 | P2 | Coarse `requireAdmin()` everywhere; admins could grant themselves owner; `super_admin`/`viewer`/`moderator` phantom roles. | FIXED | `src/lib/security/permissions.ts` (owner/admin/manager/sales/content); only owners grant/revoke owner; no self-modification; last-owner protection; audit log. 30+ tests. |
| SEC-11 | P2 | MFA skippable; enrolled factors not enforced. | PARTIAL | Enrolled factor now always required (`nextLevel=aal2`); MFA forced when granting owner/admin. Env-allowlist bootstrap accounts are not forced to enrol (would risk lock-out without a verified enrolment test). |
| SEC-12 | P2 | CSP `script-src 'unsafe-inline'` everywhere. | PARTIAL / ACCEPTED | Staff area (`/admin`, `/auth`): per-request **nonce + `'strict-dynamic'`**, no unsafe-inline (verified: 24/24 scripts nonced, hydration OK, no violations). Public static/ISR pages keep `'unsafe-inline'` (nonces force dynamic rendering); known sinks escaped. |
| SEC-13 | P2 | Client-supplied `cf-connecting-ip` trusted first → rate limits bypassable on Vercel. | FIXED | Platform-aware `clientIp()`; `ip.test.ts`. |
| SEC-14 | P3 | Turnstile: `TURNSTILE_SKIP` honoured in prod; no timeout; Cloudflare outage → 500 before lead saved. | FIXED | Production never skips; 5 s timeout; hostname check; outage = lead kept and flagged, invalid token = quarantined. |
| SEC-15 | P3 | Newsletter signup re-subscribed opted-out people; raw-UUID unsubscribe tokens. | FIXED — NOT DEPLOYED | Double opt-in; confirmation link required to (re)subscribe; hard bounces/complaints never re-subscribed (DB-tested). |
| SEC-16 | P3 | SECURITY DEFINER functions without `search_path`. | FIXED — NOT DEPLOYED | `alter function … set search_path`. |
| SEC-17 | P3 | Retired `bids`/`chat_*` tables writable by any signed-up user. | FIXED — NOT DEPLOYED | Writes revoked (tested). Tables not dropped (no data destroyed). |
| SEC-18 | P3 | No `server-only` boundaries. | FIXED | Added to auth, data, email, invoice and Turnstile modules. |
| SEC-19 | P3 | Plaintext credentials in `scratch/` (gitignored). | OPEN | Owner action: delete the files, rotate the credentials. |
| SEC-20 | P3 | Audit log mutable by service role; many actions unaudited. | PARTIAL | Append-only trigger (tested). Roles, blog, email, invoices (via `invoice_events`), pending roles now audited. Leads, settings, FAQs, testimonials, catalogue: **OPEN**. |
| SEC-21 | P3 | Vehicle image keys unvalidated (external URLs stored); blog upload used raw filenames. | FIXED | `vehicleImagesSchema` (`vehicles/` keys only); random UUID keys + type allowlist for blog images; external media URLs render the placeholder. Customer photo uploads remain unimplemented (no exposure). |
| SEC-22 | P3 | Email campaign status accepted from the form. | FIXED | Status changes only through conditional, audited actions. |
| SEC-23 | P4 | Meta webhook verify-token compared with `===`. | FIXED | Constant-time compare. |
| SEC-24 | P4 | DB error text returned to callers. | FIXED (touched modules) | Invoices, blog, email, roles, cron (tiktok) now log server-side, return generic messages. |
| SEC-25 | P4 | Token-authenticated syndication feed publicly CDN-cached for a day. | FIXED | `private, max-age=300`. |
| SEC-26 | P4 | Draft vehicle title/price leaked via `?vehicle=` prefill. | FIXED | Prefill limited to available/reserved. |
| SEC-27 | P4 | Public `fetchModels` Server Action hit an uncached query. | FIXED | Cached + slug validation. |
| SEC-28 | P4 | `ilike` wildcard matching for pending roles / user search. | FIXED | Exact, lower-cased matching; stored lower-case (constraint). |
| — | P2 | Non-staff Google sign-ups received "Your staff account is ready" email. | FIXED | Welcome only after a pending role is applied. |
| — | P2 | Admin search strings injected into PostgREST `.or()` filters. | FIXED | `sanitizeSearchTerm()` + tests. |
| SEC-29 | P3 | A malformed percent-escape in a dynamic segment (`/blog/x%E0%A4%A`) made the router throw → bare `500` (noise in error monitoring, trivially repeatable). | FIXED | Proxy rejects undecodable paths with `400` + `noindex`. Runtime: `/blog/x%E0%A4%A` and `/used-cars/kia/sportage/nope-%E0%A4%A` → `400`; valid routes unaffected. |
| SEC-30 | P3 | `/contact` embedded Google Maps on load → Google `NID` third-party cookie set before any interaction (Lighthouse Best Practices 77). | FIXED | Click-to-load map; no Google request until the visitor asks. Lighthouse Best Practices 100. |
| SEC-31 | P3 | `setVehicleStatus` accepted any status string from the client. | FIXED | Allow-list against the vehicle status enum before any write; audit entry records from → to. `set-vehicle-status.test.ts`. |

## Controls summary

- **Authentication**: Supabase Auth (email/password, Google OAuth), verified with `getUser()` (never `getSession()`); TOTP MFA via `/auth/mfa`.
- **Authorization**: `src/lib/security/permissions.ts` — the single role→permission policy; enforced by `requirePermission()` (pages/actions/data) and `requireApiPermission()` (route handlers). Proxy blocks signed-out `/admin` requests before rendering.
- **Headers** (verified on responses): HSTS (2 y, preload), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, COOP, CORP, `X-Robots-Tag: noindex` on `/admin`, `/api`, `/auth` and Vercel preview deployments, `Cache-Control: no-store` on admin/api/auth.
- **Rate limits** (Redis sliding window, bounded timeouts, in-memory fallback): leads 5/10 min per IP-hash and per phone; newsletter 5/10 min per IP and 2/h per address; CTA 20/min; views 60/min. Login/password reset rely on Supabase Auth limits (Supabase CAPTCHA recommended — OPEN).
- **Cron**: `/api/cron/*` fail closed without `CRON_SECRET` (constant-time compare); scheduled in `vercel.json`.

## Deployment preconditions (in order)

1. Rotate the leaked credentials (SEC-00).
2. Apply migration `0024` (its `email_*` tables do not exist on the configured project; `0023`'s `blog_tags` does, so 0023 appears applied — confirm with `supabase migration list`), then `20260924100000_security_hardening`, `20260924100100_invoice_integrity`, `20260924100200_email_delivery`, `20260924100300_vehicle_slug_hygiene`. The application code depends on the first three: invoices, email marketing and newsletter signup will error until they exist. The fourth repairs one live vehicle slug (see DB-31).
3. Set `EMAIL_TOKEN_SECRET` (32+ random chars), `CRON_SECRET`, `TURNSTILE_SECRET_KEY`, `REDIS_URL`, `IP_HASH_SECRET` in production.
4. Confirm `TURNSTILE_SKIP` is unset in production (it is now ignored there anyway).
