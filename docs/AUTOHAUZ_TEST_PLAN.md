# AutoHauz — Test Plan

## How to run

```bash
npm test            # vitest run — unit, integration, component and PGlite database tests
npx tsc --noEmit    # type check
npm run lint        # eslint (0 errors / 0 warnings expected)
npm run build       # production build (needs network for next/font)
```

Last full run (2026-09-25): **44 files, 335 tests, all passing**; `tsc` clean; ESLint clean.

## Layers

| Layer | Tooling | What it proves | Files |
|---|---|---|---|
| Database | PGlite 0.5.8 (PostgreSQL 18.3 in WASM; Supabase runs 15–17, so version-specific behaviour is a residual risk) + Supabase shim (`anon`/`authenticated`/`service_role`, default privileges, `auth.uid()`, `storage.*`) applying every migration in CLI order | Grants/RLS, triggers, RPC behaviour, constraints — real Postgres semantics, no network | `src/__tests__/db/{migrations,invoices,email}.test.ts` |
| Authorization | Vitest with mocked Supabase | Role → permission policy, redirects for signed-out / non-staff / MFA-pending / insufficient role, API 401/403 | `permissions.test.ts`, `require-permission.test.ts`, `admin-auth.test.ts`, `admin-allowlist.test.ts` |
| Security helpers | Vitest | Open-redirect guards, CSP builder, client-IP trust, geo policy, search-term sanitising, HTML sanitiser, JSON-LD escaping, email tokens | `routing`, `csp`, `ip`, `geo-restriction`, `search`, `sanitize`, `json-ld`, `tokens` tests |
| Source guards | Vitest reading `src/` | No literal `\${` in source; no raw `JSON.stringify` inside JSON-LD script tags | `source-guards.test.ts` |
| Domain logic | Vitest + fast-check | GST/invoice maths, invoice view-model (snapshots vs live settings), ABN checksum, finance calc, syndication readiness/volume guard, SEO listing rules, phone/WhatsApp formatting | `calc`, `document`, `abn`, `finance`, `syndication/*`, `seo/*`, `phone`, `whatsapp` |
| Rendering | Vitest (node) | Invoice PDF renders valid, paginates long invoices, renders drafts | `pdf.test.tsx` |
| Server Actions / routes | Vitest with mocked clients | Vehicle update + status rules, bulk-upload images, newsletter route (identical responses, double opt-in) | `integration/*`, `newsletter/route.test.ts` |
| Components | Testing Library (jsdom) | Button, empty state, sortable table (keyboard button headers), pagination | `properties/*`, `button.test.ts` |
| Runtime (manual, recorded) | `next start` + Chrome DevTools | Status codes, headers/CSP, Lighthouse, performance traces, keyboard flows, responsive overflow | see QA report |

## Security regression checklist (run before every release)

1. Signed-out `GET /admin/*` → 307 to `/auth/sign-in`; forged `RSC: 1` request → 307.
2. `/auth/callback?next=/%09/evil.com` and `redirectedFrom=javascript:…` never leave the site.
3. `GET /api/v1/invoices/test-seed` → 404.
4. Staff pages carry a nonce CSP without `'unsafe-inline'` for scripts; no CSP violations in the console.
5. `X-Robots-Tag: noindex` on `/admin`, `/api`, `/auth` and preview deployments.
6. `npm test` DB suite green (grants, append-only audit log, invoice immutability, suppression).
7. Malformed path escape → 400; `/api/health` → 200 for curl.

## Gaps (not automated)

| Gap | Risk | Plan |
|---|---|---|
| **No end-to-end browser tests** (Playwright not installed) | Regressions in full journeys (enquiry submit, admin create → publish → invoice) only caught manually | Add Playwright against a seeded local Supabase: public enquiry, sign-in + MFA, vehicle create/publish, invoice draft → issue → PDF, campaign test send |
| Live Supabase (PostgREST/GoTrue/storage-api) not in the loop | PGlite does not model PostgREST filters or storage policies | Run the same DB suite against `supabase start` in CI |
| SMTP delivery | Emails could fail silently in production | Test send from Admin → Email after deploy; monitor bounces |
| Turnstile production keys | Misconfiguration blocks leads (outage path keeps the lead, flagged) | Submit one real enquiry after deploy |
| Load / rate-limit behaviour | Redis latency under load | Out of scope for this audit |
| Screen-reader walkthrough | See accessibility audit | Human AT session |
