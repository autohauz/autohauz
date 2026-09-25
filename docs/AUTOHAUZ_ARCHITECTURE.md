# AutoHauz — Architecture (as built, 2026-09-25)

Describes the code in the working tree, including the uncommitted remediation. Where the database side depends on unapplied migrations it is marked **(pending migration)**.

## 1. Request path

```
Browser ──► Vercel edge ──► src/proxy.ts ──► App Router (RSC / route handlers / Server Actions) ──► Supabase
```

`src/proxy.ts`, in order:

1. **Bad-bot filter.** Returns 403 (`/api/health` exempt).
2. **Malformed-path check.** A path that fails `decodeURIComponent` gets 400.
3. **Geo gate.** Allows AU and IN. SEO files, health/cron endpoints and good-faith crawlers are exempt. Blocked requests get a 451 JSON response for machine clients, otherwise the `/geo-blocked` page.
4. **Staff zone (`/admin`, `/auth`).**
   - Sets a per-request nonce CSP with `'strict-dynamic'`.
   - Refreshes the Supabase session.
   - Redirects signed-out `/admin` requests to `/auth/sign-in?redirectedFrom=…`, then `safeAdminRedirect`.
5. **`X-Robots-Tag: noindex`** on `/admin`, `/api` and `/auth`, and on every page of Vercel preview deployments.

The matcher skips static assets (images, fonts, txt/xml/webmanifest/csv).

Public pages get a **static CSP** (`buildCsp` in `next.config.ts`), so they can stay static/ISR. Nonces would force dynamic rendering.

## 2. Rendering and caching

| Route type | Strategy |
|---|---|
| Home, about, contact, FAQs, legal, sell, trade-in | ISR (`revalidate` 300–3600 s) |
| `/used-cars` | ISR 60 s. Filters, sort and page come from search params, so filtered views render dynamically. |
| Make/model/body/budget landings | ISR 300 s |
| Vehicle page, blog article, blog category | On-demand ISR: `generateStaticParams() → []`, then rendered once per revalidate window |
| Admin, auth | Dynamic (`force-dynamic`, `no-store`) |

Data readers use `unstable_cache` with tags (`vehicles`, `leads`, `blog`, `settings`, `redirects`, …) through `src/lib/cache.ts`:

- **Server Actions** call `updateTags()`, which is read-your-writes.
- **Route handlers and crons** call `revalidateTags()`, which is `revalidateTag(tag, "max")` (stale-while-revalidate).

There is no root `loading.tsx`. It made 404s and redirects return a soft 200.

## 3. Security model

- **Identity.** Supabase Auth: email/password and Google OAuth, TOTP MFA. Always `getUser()`, never trusting `getSession()`.
- **Authorisation policy.** `src/lib/security/permissions.ts` holds the one role → permission map for `owner`, `admin`, `manager`, `sales` and `content`. The role comes from `admin_roles`, then `profiles.platform_role`, then the env allowlist (which gives owner).
- **Enforcement points:**
  - `requirePermission(p)` in every admin page, Server Action and private data reader. Readers are `server-only` and cached ones wrap `cached_*`.
  - `requireApiPermission(p)` in admin route handlers.
  - The nav filters by permission for convenience only.
- **Service-role client.** Server code reads and writes through it, so RLS is **not** the app's primary guard. It protects direct PostgREST use:
  - SECURITY DEFINER RPCs are executable only by `service_role` **(pending migration)**.
  - Profile identity is locked, and owner rows are guarded by triggers **(pending migration)**.
  - Role-granular RLS per table: OPEN (SEC-09).
- **Input.** zod validates every action and route. Blog HTML is sanitised on save. JSON-LD goes through `serializeJsonLd`. Admin search terms are sanitised before PostgREST `.or()`. Vehicle image keys must be `vehicles/…` storage keys.
- **Abuse controls.**
  - Turnstile never skips in production; if Cloudflare is down, the lead is kept and flagged.
  - Rate limits use a Redis sliding window with a 2 s connect and 0.8 s command timeout, falling back to in-memory.
  - IPs are platform-aware and hashed with `IP_HASH_SECRET`.
- **Secrets.** Server-only env, validated by `src/lib/env.ts`. Cron routes fail closed without `CRON_SECRET` (constant-time compare).

## 4. Domain modules

| Module | Key files | Notes |
|---|---|---|
| Inventory / DMS | `lib/data/inventory.ts`, `app/admin/inventory/actions.ts`, `api/admin/bulk-upload` | Status allow-list and first-publication date; photos in the `media` bucket under `vehicles/`; external URLs render a placeholder |
| Leads / CRM | `api/v1/leads` (public intake: zod validation → rate limit (IP hash + phone) → Turnstile → `create_lead_with_event` RPC → staff notification email), `app/admin/leads/actions.ts` | Spam status, audited delete |
| Invoices | `lib/invoices/{calc,document,pdf}.tsx`, `app/admin/invoices/actions.ts`, RPCs `save_invoice_draft`, `issue_invoice`, `check_invoice_payment` **(pending migration)** | See below |
| CMS / blog | `lib/data/blog.ts`, `lib/content/sanitize.ts`, TipTap editor | Scheduled posts become visible at their time; server-side sanitising |
| Email marketing | `lib/email/{blocks,tokens,marketing}.ts`, RPCs `subscribe_request`, `confirm_subscription`, `unsubscribe_email_contact`, `start_email_campaign`, `claim_email_sends` (`FOR UPDATE SKIP LOCKED`), `finish_email_campaign` **(pending migration)** | See below |
| Business identity | `lib/data/business.ts` → `getBusinessProfile()` | The single source for footer, contact page, JSON-LD, phones, invoices and email footers |
| SEO | `lib/seo/{metadata,listing,jsonld,blog,guards}.ts`, `app/{robots,sitemap,manifest}.ts` | One metadata builder per page; the sitemap lists indexable URLs only |

**Invoices in detail:**
- GST is calculated per line, with proportional discounts.
- Seller and vehicle snapshots are frozen when the invoice is issued.
- Numbering is `PREFIX-YYYY-NNNNNN` in the Sydney year.
- Issued invoices and their items are immutable, and payments are append-only.
- Screen, print and PDF all render from one view-model.

**Email marketing in detail:**
- Double opt-in, with HMAC tokens for confirm and unsubscribe.
- RFC 8058 one-click unsubscribe.
- A suppression trigger and a send queue unique per (campaign, contact).
- The daily cron sends in batches.

## 5. Frontend

- **Design tokens.** Defined in `globals.css` (Tailwind v4 `@theme`), with semantic utilities only. See `DESIGN.md`.
- **Server components by default.** Client islands are forms, the gallery, filters, the mobile menu (code-split sheet), the WhatsApp float and the admin UI.
- **Images.**
  - Static photography is pre-encoded to responsive WebP by `scripts/build-responsive-images.mjs` and served through `<ResponsiveImage>`.
  - The Next image optimiser is disabled on purpose (cost/WAF). Vehicle photos come from Supabase storage.
- **Fonts.** One variable font, Archivo, self-hosted by `next/font`.
- **Third parties on public pages.** Cloudflare Turnstile appears only on form pages, and Google Maps loads only on click on `/contact`. Vercel Analytics, Speed Insights and GA load only when configured.

## 6. Scheduled work (`vercel.json`)

| Cron | Schedule (UTC) | Purpose |
|---|---|---|
| `/api/cron/email-campaigns` | 21:00 daily | Start due campaigns, send queued batches |
| `/api/cron/reminders` | 21:30 daily | Staff reminders for leads still "new" past the first-contact window |

These cron routes exist but are **not scheduled**, because their integrations are unconfigured: `price-assertion`, `process-webhooks`, `syndicate`, `tiktok-sync`.

## 7. Known architectural debt

- **Vehicle save is multi-step, not transactional (DB-09).** Recommendation: a `save_vehicle` RPC.
- **No generated Supabase types (DB-15).** Recommendation: `supabase gen types` in CI.
- **Admin lists are capped without pagination (DB-14).**
- **Migration naming.** `20240915_…` sorts after `0024_…`. New migrations use `YYYYMMDDHHMMSS_` (DB-21).
- **Public first-load JS is 220–265 KB gzip, above the 200 KB budget.** See the performance audit.
