# AutoHauz — Database Audit

Scope: `supabase/migrations/` (0001–0024, `20240915_pending_admin_roles`, and three new 2026-09-24 migrations), the data layer (`src/lib/data/*`), and the live project's table inventory (read-only probe, 2026-09-24; further production reads were stopped by policy).

## Live project state (observed read-only, 2026-09-24)

| Observation | Evidence |
|---|---|
| 6 vehicles, all `available`; 6 `media_assets` whose storage keys are **external Unsplash URLs** (stock photos rendered as listing photos; blocked by the CSP) | table counts; browser console on `/` |
| `email_*` tables **do not exist** → migration 0024 not applied; the email-marketing admin could not have worked | PostgREST `PGRST205` |
| `admin_roles` has 0 rows → all staff access currently comes from the `ADMIN_EMAIL_ALLOWLIST` env bootstrap | table count |
| `settings` has `company_profile`, `phone_numbers`, `finance_params`, `notification_recipients`, `blocked_dates`, `legal_text`; no `business_address`/`invoice_settings` rows | key list |
| 0 leads, 0 invoices, 0 testimonials, 4 blog categories, 0 articles | table counts |

**NEEDS CONFIRMATION (owner):** are the 6 listed vehicles real stock? Their photos are stock images from Unsplash.

## Test harness

`src/__tests__/db/harness.ts` applies every migration, in Supabase-CLI order, to **PGlite** (Postgres compiled to WASM) with a shim for Supabase's roles (`anon`/`authenticated`/`service_role`), default privileges, `auth.uid()`, `auth.users` and `storage.*`. 38 database tests run in the normal `vitest` suite (`src/__tests__/db/*.test.ts`); all migrations apply cleanly.

Not modelled: PostgREST itself, GoTrue, storage-api.

## Findings

| ID | Sev | Finding | Status |
|---|---|---|---|
| DB-01 | P0 | Public EXECUTE on SECURITY DEFINER functions (see SEC-01). | FIXED — NOT DEPLOYED |
| DB-02 | P0 | Public invoice test-seed endpoint. | FIXED |
| DB-03 | P0 | Broken marketing unsubscribe links. | FIXED |
| DB-04 | P1 | Meta lead ingest upserts `ON CONFLICT (channel_code, channel_lead_id)` against a *partial* unique index → Postgres 42P10, every Meta lead fails. | OPEN — Meta integration is unconfigured and its cron unscheduled; fix before enabling (full unique index or RPC with matching predicate). |
| DB-05 | P1 | Campaigns: double sends, segments and suppressions ignored, fire-and-forget send. | FIXED — NOT DEPLOYED (`start_email_campaign`/`claim_email_sends`/`finish_email_campaign`, 8 DB tests) |
| DB-06 | P1 | Invoice issue race could renumber an issued invoice; issued invoices editable. | FIXED — NOT DEPLOYED (`issue_invoice()` atomic + immutability triggers, 12 DB tests) |
| DB-07 | P1 | Newsletter signups never reached the campaign list. | FIXED — NOT DEPLOYED (single list `email_contacts`, double opt-in) |
| DB-08 | P1 | No seller snapshot on invoices; VIN column misnamed (`vin_masked`) so vehicle particulars never loaded. | FIXED — NOT DEPLOYED (`seller_snapshot`, `vehicle_snapshot`, `document_title`; data layer selects `vin`) |
| DB-09 | P2 | Multi-step writes not transactional (invoice header/items; vehicle/images). | PARTIAL — invoices FIXED (`save_invoice_draft()`); vehicle create/update still multi-step: OPEN |
| DB-10 | P2 | Leads: no status rules, "mark spam" sets `lost`, hard delete by any role, not audited. | PARTIAL — spam is its own status, `first_contacted_at` kept, `closed_at` cleared on reopen, delete manager+ and audited; a DB-level transition table is still OPEN |
| DB-11 | P2 | Vehicles: no status transition rules; `published_at` reset on every status change; hard delete. | PARTIAL — status allow-listed; `published_at` set only on first publication; `sold_at` cleared when a sale falls through; publish/unpublish and delete go through a confirmation dialog (4 tests). Hard delete remains available to `inventory.delete` holders (archive is suggested in the dialog). |
| DB-12 | P2 | Every page view rewrites the `vehicles` row and enqueues a never-drained search job. | OPEN (view tracking route is fixed but not wired to the VDP, so no writes happen today) |
| DB-13 | P2 | Scheduled blog posts never publish; `published_at` lost on edit. | FIXED (publish-time visibility rule + first-publish date preserved) |
| DB-14 | P2 | Admin lists hard-capped (500/200) without pagination; search injected into PostgREST filters. | PARTIAL — search sanitised (FIXED); pagination OPEN |
| DB-15 | P2 | No generated Supabase types; `any` at the DB boundary. | PARTIAL — invoices, blog, email modules now use explicit row types; `supabase gen types` still OPEN |
| DB-16 | P2 | Single GST flag per invoice; tax invoice printable without an ABN. | FIXED (per-line `gst_applicable`, ABN required to issue a tax invoice) |
| DB-17 | P2 | `email_contacts` defaulted to `subscribed` without consent. | FIXED — NOT DEPLOYED (default `pending`, CHECK constraint, suppression trigger) |
| DB-18 | P2 | Unsubscribe didn't suppress, reported success on failure. | FIXED — NOT DEPLOYED |
| DB-19 | P3 | Audit log not append-only. | FIXED — NOT DEPLOYED |
| DB-20 | P3 | FKs to `profiles` without ON DELETE block staff deletion. | PARTIAL — `activity_logs` fixed; others OPEN |
| DB-21 | P3 | Migration naming: `20240915_…` sorts after `0024_…`, so any `0025_…` would be refused by `db push`. | FIXED for new work (new migrations use `YYYYMMDDHHMMSS_`); history repair OPEN |
| DB-22 | P3 | `blog_articles.status` unconstrained text. | PARTIAL — app validates (zod enum); DB CHECK OPEN |
| DB-23 | P3 | Invoice year taken in UTC. | FIXED — NOT DEPLOYED (Australia/Sydney) |
| DB-24 | P3 | Payment trigger read `NEW` on DELETE; no amount checks; overpayment allowed. | FIXED — NOT DEPLOYED |
| DB-25 | P3 | Retention/expiry jobs never run; `lead-cleanup` edge function calls a missing RPC. | OPEN |
| DB-26 | P3 | Price history never records who changed the price. | OPEN |
| DB-27 | P3 | Retired `bids`/`chat_*` tables writable. | FIXED — NOT DEPLOYED |
| DB-28 | P3 | Facets capped by PostgREST `max_rows` (1000). | ACCEPTED (documented in code; GROUP BY RPC needed above ~1000 live cars) |
| DB-29 | P3 | Bulk upload invents fuel/transmission/body defaults and random stock ids. | OPEN |
| DB-30 | P4 | Redundant indexes, missing indexes for admin filters, case-sensitive uniques. | OPEN |
| DB-31 | P1 | A live vehicle's slug contains a space (`2019-mitsubishi-pajero sport-gls-d006`): the listing links to it, the vehicle page returned **404**, and the sitemap emitted an invalid URL. Both app writers already slugify; the row came from seed/manual entry. | FIXED (app) / FIXED — NOT DEPLOYED (data) — route params are decoded (page now 200), sitemap URLs percent-encoded; `20260924100300_vehicle_slug_hygiene.sql` normalises bad slugs, adds a 301 from the old path and a `vehicles_slug_format` CHECK (2 DB tests) |

## New migrations (not applied)

| File | Purpose | Tests |
|---|---|---|
| `20260924100000_security_hardening.sql` | RPC grants, search_path, profile identity lock, owner-role guard, pending-role constraints, retired-table writes, append-only audit log, consent defaults | `migrations.test.ts` (16) |
| `20260924100100_invoice_integrity.sql` | Per-line GST, snapshots, value CHECKs, Sydney-year numbering, `save_invoice_draft`, `issue_invoice`, immutability, payment guard | `invoices.test.ts` (12) |
| `20260924100200_email_delivery.sql` | Consent columns, suppression trigger, double opt-in RPCs, unsubscribe RPC, send queue RPCs, template blocks | `email.test.ts` (8) |
| `20260924100300_vehicle_slug_hygiene.sql` | Normalise malformed vehicle slugs, 301 from the old path, slug-format CHECK | `migrations.test.ts` (2) |

The first three are additive and idempotent (no drops, no data rewrites). The fourth rewrites only slugs that fail the URL-safe format (one row today) and records a redirect for each, so no inbound link breaks. Order matters: they depend on 0022 and 0024.
