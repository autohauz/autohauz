# AutoHauz — Repository Audit (Phase 0) and Findings Index

Audit window: 2026-09-24 → 2026-09-25. Repository: the AutoHauz Next.js app (git `main`, last commit `74de6a8`; all remediation work is **uncommitted** in the working tree — 257 changed/new paths — and has not been deployed).

This file is the entry point. Specialist detail lives in:
[Security](AUTOHAUZ_SECURITY_AUDIT.md) · [Database](AUTOHAUZ_DATABASE_AUDIT.md) · [Head/SEO](AUTOHAUZ_HEAD_SEO_AUDIT.md) · [Performance](AUTOHAUZ_PERFORMANCE_AUDIT.md) · [Accessibility](AUTOHAUZ_ACCESSIBILITY_AUDIT.md) · [Design](AUTOHAUZ_DESIGN_AUDIT.md) · [Features](AUTOHAUZ_FEATURE_MATRIX.md) · [Architecture](AUTOHAUZ_ARCHITECTURE.md) · [Tests](AUTOHAUZ_TEST_PLAN.md) · [Final QA](AUTOHAUZ_FINAL_QA_REPORT.md) · [`DESIGN.md`](../DESIGN.md)

## 1. What the product is

A single Australian used-car dealership (Kings Park NSW): a public sales/lead-generation website (inventory, vehicle pages, finance/sell/trade-in/contact enquiries, blog) plus a staff back office (DMS inventory, CRM leads, tax invoices, CMS, email marketing, settings, roles). Not a rental or marketplace product.

## 2. Stack (observed, not assumed)

| Layer | Version / detail |
|---|---|
| Framework | Next.js **16.2.6** App Router, Turbopack build, `src/proxy.ts` (the Next 16 name for middleware) |
| UI | React 19.2.4, Tailwind CSS v4 (`@theme`), Base UI 1.5, lucide icons, TipTap 3 (admin editor) |
| Data | Supabase (Postgres, Auth, Storage) via `@supabase/ssr` 0.10 / `supabase-js` 2.106; server reads use the **service-role** client behind `requirePermission()` |
| Validation | zod 4 |
| Email | nodemailer (SMTP) |
| PDF | `@react-pdf/renderer` 4.9 |
| Rate limiting | ioredis (sliding window) with in-memory fallback |
| Bot protection | Cloudflare Turnstile |
| Hosting | Vercel (crons in `vercel.json`; Analytics + Speed Insights) |
| Tests | Vitest 4, Testing Library, fast-check, **PGlite** (Postgres-in-WASM) for migration/RLS tests |

Supply-chain note: `xlsx` is installed from the SheetJS CDN tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/…`), not npm — deliberate upstream practice, pinned by version; used only by admin bulk upload.

## 3. Inventory

- **Public pages (26)**: `/`, `/used-cars` (+ make, make/model, body, budget landings, vehicle page), `/finance`, `/trade-in`, `/sell-your-car`, `/contact`, `/about`, `/how-it-works`, `/faqs`, `/testimonials`, `/blog` (+ article, category), `/legal/[slug]`, `/thank-you`, `/newsletter/{confirm,unsubscribe,unsubscribe/confirmed}`, `/geo-blocked`; redirects `/faq`, `/search`, `/success-stories`, `/legal/rules`.
- **Staff pages (29)**: `/admin` dashboard, inventory (list/new/edit), catalogue, leads (list/detail), invoices (list/new/detail/edit), blog (list/new/edit/categories), email (overview, campaigns, contacts, segments, templates), FAQs, testimonials, settings, roles, audit log; `/auth/sign-in`, `/auth/mfa`, `/admin-login`.
- **Route handlers (18)**: `/api/v1/{leads,newsletter,cta-clicks,email/unsubscribe,invoices/[id]/pdf}`, `/api/vehicles/[id]/view`, `/api/admin/bulk-upload`, `/api/syndication/feed/[channelCode]`, `/api/webhooks/meta`, `/api/cron/{email-campaigns,reminders,price-assertion,process-webhooks,syndicate,tiktok-sync}`, `/api/health`, `/auth/{callback,sign-out}`.
- **Server Action modules (10)**: blog, catalogue, email, FAQs, inventory, invoices, leads, roles, settings, testimonials (+ public `app/actions/inventory.ts`).
- **Crons scheduled** (`vercel.json`): email campaigns 21:00 UTC, reminders 21:30 UTC. `price-assertion`, `process-webhooks`, `syndicate`, `tiktok-sync` exist but are **not scheduled** (their integrations are unconfigured).
- **Supabase**: 24 numbered migrations + `20240915_pending_admin_roles` + 4 new (unapplied) migrations; edge functions `lead-cleanup` (calls a missing RPC — DB-25) and `search-index-worker`.
- **Environment variable names** (`.env.example`, values never printed): app URL, Supabase URL/publishable/service-role keys, Turnstile, GA, Search Console, socials, `ADMIN_EMAIL(_ALLOWLIST)`, `CRON_SECRET`, geo settings, Redis, `IP_HASH_SECRET`, SMTP, `EMAIL_TOKEN_SECRET` (new), syndication feed settings, Meta app/webhook/page tokens, `WORKER_API_KEY`.

## 4. Live data snapshot (read-only probe, 2026-09-24; further production reads stopped by policy)

6 vehicles (all `available`) whose photos were **external Unsplash URLs** (now rendered as the neutral placeholder); 0 leads, 0 invoices, 0 testimonials, 0 articles; `admin_roles` empty (staff access comes from the env allowlist); migration 0024 (`email_*`) **not applied**. One vehicle has a malformed slug (DB-31).

## 5. Severity summary (all findings across the specialist audits)

Counted from the finding tables (DB-01…03 duplicate SEC-01/02/08 and are counted in both). "Not deployed" = implemented and tested against real Postgres semantics, waiting for the migrations to be applied.

| Audit | Sev | Fixed | Fixed — not deployed | Partial | Open | Accepted |
|---|---|---|---|---|---|---|
| Security | P0 | 1 | 1 | 1 (SEC-00: rotation pending) | 0 | 0 |
| | P1 | 4 | 2 | 0 | 0 | 0 |
| | P2 | 4 | 0 | 3 | 0 | (SEC-12 public CSP partly accepted) |
| | P3 | 7 | 3 | 1 | 1 (SEC-19 owner files) | 0 |
| | P4 | 6 | 0 | 0 | 0 | 0 |
| Database | P0 | 2 | 1 | 0 | 0 | 0 |
| | P1 | 0 | 5 (one also fixed in app) | 0 | 1 (DB-04) | 0 |
| | P2 | 2 | 2 | 6 | 1 (DB-12) | 0 |
| | P3 | 1 | 4 | 2 | 3 | 1 (DB-28) |
| | P4 | 0 | 0 | 0 | 1 (DB-30) | 0 |

Accessibility, SEO, performance and design findings are tracked in their own documents with the same statuses.

**No P0/P1 code defect remains open.** What remains at P0/P1 is owner/deployment work: rotate the exposed credentials (SEC-00) and apply the migrations (SEC-01, SEC-07, SEC-08, DB-05…08, DB-31). DB-04 is dormant until the Meta integration is switched on.

### P0 / P1 index

| ID | Finding | Status |
|---|---|---|
| SEC-00 | Service-role key, admin password, Supabase management token exposed on disk / in an unpushed commit | History rewritten by owner (verified clean); **rotate credentials — OPEN (owner)** |
| SEC-01 / DB-01 | SECURITY DEFINER RPCs executable by `anon` (e.g. wipe all lead PII) | FIXED — NOT DEPLOYED (DB-tested) |
| SEC-02 / DB-02 | Public invoice test-seed endpoint | FIXED (404 verified) |
| SEC-03 | Admin protected only by the layout ("[DEMO MODE]") | FIXED (every page/action/reader guarded; RSC bypass → 307) |
| SEC-04/05 | Open redirect / XSS via `redirectedFrom` and `next` | FIXED (tests + runtime) |
| SEC-06 | Stored XSS in blog JSON-LD | FIXED (+ source guard) |
| SEC-07 | Role hijack via editable `profiles.email` | FIXED (app) + NOT DEPLOYED (trigger) |
| SEC-08 / DB-03 | Unsubscribe links were literal `${…}` text (Spam Act) | FIXED — NOT DEPLOYED |
| DB-05/06/07/08 | Email double sends; invoice renumbering/editing after issue; newsletter list disconnected; no seller snapshot | FIXED — NOT DEPLOYED |
| DB-31 | Vehicle page 404 from a slug with a space | FIXED (app) + NOT DEPLOYED (data) |
| DB-04 | Meta lead upsert conflicts with a partial index | OPEN (integration off) |
| — | Dashboard showed fabricated "[DEMO MODE]" numbers; homepage showed fabricated Google reviews | FIXED (real counts; real reviews only) |
| — | VDP Call/WhatsApp buttons missing (phone source mismatch) | FIXED (verified) |
| — | Root `loading.tsx` turned every 404/redirect into a soft 200 | FIXED (308/404 verified) |

## 6. Agent / skill usage (no agent theatre)

The master prompt names external agent systems (Jarvis orchestrator, design-taste v1/v2, redesign skill, UX architect, design critic, DESIGN.md agent, AU SEO composite, AI-visibility reviewer, AI-app reference, Antigravity). **None of those repositories were installed or executed in this environment. They are REFERENCE-ONLY**: their stated rules (inspect-before-change, anti-slop design rules, DESIGN.md as visual memory, evidence-based SEO, no fake status) were applied as checklists by the engineer. Tools actually used: Next.js docs knowledge, Chrome DevTools (Lighthouse 13.4.1, performance traces, DOM/network inspection), PGlite, Vitest, ESLint, TypeScript.

## 7. Repository hygiene

- `scratch/` (git-ignored) still holds the owner's credential-bearing scripts `create-admin.mjs`, `login.js`, `push-sql.js`, `create-audit-docs.js` — **delete after rotating credentials** (SEC-19). The engineer's own one-off edit scripts were moved out of the repository.
- Nothing has been committed, pushed, or applied to the production database by the engineer.
