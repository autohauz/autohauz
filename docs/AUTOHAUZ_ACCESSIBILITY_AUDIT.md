# AutoHauz — Accessibility Audit (WCAG 2.2 AA target)

Method: source review of every public and admin component, contrast computed with the WCAG relative-luminance formula, runtime checks in a production build. No assistive-technology session (screen reader user testing) was performed — **NOT VERIFIED** with real AT.

## Already sound (kept)

`lang="en-AU"`; global `:focus-visible` ring + forced-colours fallback; skip link on public pages; `Field` wiring (visible label, `aria-describedby`, `role="alert"` errors, `aria-required`); lead forms (autocomplete, loading/disabled states, success `role="status"`); listing filters (fieldset/legend, `aria-pressed`, live result count); pagination `aria-current`; native `<details>` FAQs; Base UI dialogs/sheets (focus trap, Escape); sticky VDP CTA bar.

## Fixed

| ID | WCAG | Issue | Fix |
|---|---|---|---|
| E-01 | — (honesty) | Fabricated reviews / rating with Google branding | Real data only; section hidden when none |
| A11Y-01/UI-03 | 1.4.3, 2.4.11 | WhatsApp pill white-on-green 1.98:1; covered the VDP CTA (broken class) | Solid `#075E54` (7.5:1); VDP hide rule fixed |
| A11Y-02 | 2.4.7 | Finance sliders: `outline:none` in unlayered CSS beat the focus style | Explicit `:focus-visible` outline |
| A11Y-03 | 1.1.1 | Stars / Google logo without text alternative | sr-only "Rated N out of 5"; logo removed |
| A11Y-04 | 2.3.3 (AAA), robustness | framer-motion reveal ignored reduced motion; content `opacity:0` until JS | Animations removed; content in server HTML |
| A11Y-05 | 2.4.7 | Gallery "N photos" button invisible but focusable | Always visible |
| A11Y-06 | 4.1.2 | Thumbnails as `role="tab"` with no tabpanel | Buttons with `aria-current`, "Photo i of n" |
| A11Y-07 | 2.1.1 | Admin table sort mouse-only (`onClick` on `<th>`) | `<button>` in header, `aria-sort` incl. `none` |
| A11Y-09 | 1.3.1, 3.3.2 | Invoice line labels not associated | `htmlFor`/`id` on every line control |
| A11Y-10 | 4.1.2 | Icon-only controls without names (invoice line remove, template edit, email builder, contacts, segments) | `aria-label`s; icons `aria-hidden` |
| A11Y-11 | 4.1.3 | Errors not announced (sign-in, blog form, email forms) | `role="alert"` |
| A11Y-12 | 2.5.x | Card photo arrows under the stretched-link overlay | `z-10`, `type="button"`, `focus-visible` reveal |
| A11Y-13 | 1.4.1, 4.1.2 | Colour-only selected state (featured pills, blog categories, admin nav) | `aria-pressed` / `aria-current` |
| A11Y-14 | 1.4.3 | Hero CTA white on `#0A7AF5` 4.11:1; small azure eyebrows on navy ~4.4:1 | Accent token (5.6:1); azure-300 (~7:1) |
| A11Y-15 | 1.1.1, 1.3.1 | Sign-in: navy logo on navy; `h2` before `h1`; marketing claims to staff | Dark logo variant; panel title is a `<p>`; staff copy |
| A11Y-16 | 1.3.1 | Blog heading order (h1→h3, h3→h4) | h2 cards, h2/h3 sidebar |
| A11Y-17 | 1.1.1 | Decorative hero/banner/tile images with alt text ("AutoHauz Showroom", "SUV SUV") | `alt=""` |
| A11Y-18 | 2.4.3 | Focus lost after lead form success | Focus moves to the confirmation heading |
| A11Y-19 | 4.1.3 | Two toast regions in admin | Root toaster removed |
| A11Y-20 | 2.3.3 | `animate-pulse` not covered by reduced motion | Added to the reduced-motion rule |
| UI-12 | 2.4.1, 4.1.2 | Admin: no skip link; mobile menu toggle without state | Skip link; `aria-expanded`/`aria-controls`; nav `aria-label` |
| UI-17 | — | Unsubscribe confirmshaming copy; page outside the site frame | Neutral copy, header/footer, `main#main` |
| — | 2.4.2 | Duplicate/branded titles | Unique titles via template |

| A11Y-08 | 1.4.11, 2.4.7 | Admin inputs `focus:outline-none` + `ring-primary/40` (~2:1) in vehicle form, catalogue, syndication, audit filter, table page-size | Global `:focus-visible` outline restored, `focus-visible:border-accent-bright`, `border-input` (3.4:1) |
| A11Y-09 | 1.3.1, 3.3.2 | Roles "Role" label not tied to its radios; inline new make/model inputs placeholder-only; inventory row status `<select>` unlabelled | `fieldset`/`legend`; `aria-label`s; sr-only `<label>` naming the car |
| A11Y-10 | 4.1.2 | Blog editor toolbar: title-only names, active marks colour-only; editor surface unnamed | `role="toolbar"`, `aria-label` + `aria-pressed` per toggle, surface `role="textbox"` `aria-multiline` "Article body", `focus-within` ring |
| UI-11 | 3.3.4 | Inventory row status published/unpublished instantly; delete used a 3 s "Confirm?" timer | ConfirmDialog for publish/unpublish and delete (consequence stated); edit/delete links named per car |
| A11Y-21 | 3.3.1, 4.1.3 | Finance consent error shown far from its checkbox; server validation returned "Validation failed" | Inline error linked by `aria-describedby`, `aria-invalid`, `role="alert"` (verified in browser); API field errors turned into "Please check your phone number and email address." |
| A11Y-22 | 1.3.1 | `/used-cars` on mobile: `h1` → card `h3` (the sidebar `h2` is `display:none`) | sr-only `h2` "Cars for sale" (Lighthouse heading-order now passes) |
| A11Y-23 | 2.4.4 | Homepage "Read more" ×3 without context | sr-only guide title (Lighthouse link-text now passes) |
| A11Y-24 | 2.4.11 | WhatsApp float covered the VDP sidebar "Call" button at desktop widths | Float hidden on vehicle pages (they carry their own WhatsApp CTA) |
| A11Y-25 | 1.3.1 | Gallery "View photo" button over the "Photo coming soon" artwork caption | Lightbox control omitted when only the placeholder exists |

## Measured (Lighthouse 13.4.1, mobile form factor, local production build, 2026-09-25)

| Route | Accessibility | Failed audits |
|---|---|---|
| `/` | 100 | 0 |
| `/used-cars` | 100 | 0 |
| `/used-cars/kia/sportage/…-d005` | 100 | 0 |
| `/finance` | 100 | 0 |
| `/sell-your-car` | 100 | 0 |
| `/contact` | 100 | 0 |

Keyboard checks performed in the browser: mobile menu (opens, focus moves into the sheet, Escape closes, focus returns to the trigger, `aria-expanded` toggles); finance consent error announcement. Lighthouse covers roughly a third of WCAG; the items below are what it cannot see.

## Open

| ID | Issue | Notes |
|---|---|---|
| — | Screen-reader (NVDA/VoiceOver) and keyboard-only walkthrough of the full buy/enquire journey and the admin | NOT VERIFIED — needs a human AT session |
| — | Admin pages audited by source only: no staff credentials were available to render them in a browser | NOT VERIFIED at runtime |
| — | Lead forms other than finance map server errors to one summary message, not to individual fields | P3 |
| — | Turnstile widget loading/failure has no text alternative of our own (Cloudflare's widget is labelled) | P3 |
| — | Blog editor link/image insertion uses `window.prompt`/`alert` | P3 — works with AT but is not styled or described |
