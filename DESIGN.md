# AutoHauz — DESIGN.md

The visual source of truth. Tokens live in `src/app/globals.css` (three tiers: literals → semantic roles → Tailwind utilities). Components use **semantic utilities only** (`bg-card`, `text-muted-foreground`, `border-input`…); hex values in components are a defect.

## 1. Brand & tone

A single Australian used-car dealership. Calm, precise, trustworthy — a well-run yard, not a startup landing page. Navy and azure from the logo; photography of real cars does the selling. No invented claims, ratings, urgency or social proof; every figure on the page is real or absent.

## 2. Colour roles

| Role | Light surface | Dark surface (`.dark`: header, hero, footer, admin sidebar, sign-in) |
|---|---|---|
| background / foreground | cloud-50 `#f6f8fb` / ink-900 `#14213d` (15:1) | navy-900 `#071b3d` / white (17:1) |
| body text | ink-700 `#3c4a63` (8.4:1) | silver-200 `#d0e0f0` (12.6:1) |
| muted-foreground | ink-500 `#5b6980` (5.2:1) | silver-200 |
| primary (buttons, headings accents) | navy-700 `#0b3573`, text white (11.9:1) | white, text navy-900 |
| accent (links, primary CTA) | azure-600 `#006da4`, text white (5.6:1) | azure-300 `#5fb3e4`, text navy-900 (7.3:1) |
| accent-bright | azure-500 `#0080c0` — **icons, focus ring and ≥18.66 px bold text only** (4.3:1 on white) | same |
| border (decorative) / input (control boundary) | line-200 / line-300 `#7f8ca3` (3.4:1, meets 1.4.11) | white 12% / silver-200 |
| success / warning / danger / info (+ `-soft` backgrounds) | green-700, amber-700, red-700, azure-600 on their 100 tints (≥4.9:1) | pastel on navy |

Rules: status is always **text + colour** (badges), never colour alone. Small text on a dark photo/gradient uses `azure-300`, never `accent-bright`. WhatsApp green is only used as the dark teal `#075E54` (7.5:1 with white).

## 3. Typography

One family: **Archivo** (variable, width axis), self-hosted via `next/font`, `display: swap`.
- Headings: `font-stretch: 112%` (`--heading-stretch`) echoes the extended wordmark; body at normal width.
- Scale (fluid `clamp`): display 36→60 px, h1 30→42, h2 24→32, h3 18→22; body 16 px, small 14 px, meta 12–13 px.
- One `h1` per page; headings never skip levels. Sentence case for UI copy ("Browse cars", not "Browse Cars").
- Numbers in prices, tables and totals use `tabular-nums`. Dates are Australian: `d MMM yyyy`, times in Australia/Sydney.

## 4. Space, shape, depth

- Spacing: Tailwind 4-px scale; section rhythm via `<Section>` (py-16/24, tight py-10/14); page gutters via `<Container>` (16/24/32 px).
- Radii: sm 4, md 8 (controls, buttons), lg 12 (cards), xl 20 (feature panels). Use `rounded-md`/`rounded-lg`/`rounded-xl`; `rounded-full` only for pills, avatars, icon buttons.
- Shadows: `shadow-card` (resting cards), `shadow-float` (popovers, dialogs, sticky bars). No stacked or coloured glows.
- z-index: header 40, sticky CTA/float 50, sheet 60, modal 70 (CSS variables).

## 5. Motion

- Only state transitions: colour/opacity 150 ms (`--duration-fast`), panels 240 ms (`--duration-base`), `--ease-out`.
- **No scroll-reveal, hover-lift, image zoom, or parallax.** Content is visible in the server HTML.
- `prefers-reduced-motion: reduce` disables transitions and animated skeletons; spinners remain as progress feedback.

## 6. Components (in `src/components/ui`)

| Component | Contract |
|---|---|
| Button / ButtonLink | Variants: default, accent, outline, secondary, ghost, destructive, destructive-solid, link. Sizes default, sm, lg, cta, icon, icon-sm (≥ 32 px; 44 px on touch contexts). Loading = spinner + `aria-busy`; disabled = 50% opacity. Icon-only buttons **must** have `aria-label`. |
| Field / Input / Textarea / Select | Visible `<label>` always (placeholder is never the label); errors linked by `aria-describedby` and announced (`role="alert"`); 44 px tall on mobile, 16 px text (no iOS zoom). Native `<select>`. |
| Dialog / Sheet | Base UI: focus trap, Escape closes, labelled title. |
| ConfirmDialog (`components/admin`) | The only confirmation pattern for consequential actions (issue, void, send, delete). No `confirm()`, no timed double-click. |
| Badge | Tinted background + saturated text; the text is the status. |
| Table / DataTable | `<caption>` (sr-only if needed), `th scope="col"`, sortable headers are `<button>`s with `aria-sort`, horizontal scroll container on small screens, empty state with a next step. |
| EmptyState / ErrorState / Skeleton | Every data view has loading, empty and error states. |
| ResponsiveImage | Static photography served as pre-encoded WebP with `srcset` (`scripts/build-responsive-images.mjs`); `priority` on the single LCP image per page; decorative images `alt=""`. |

## 7. Vehicle components

- **Vehicle card**: one tab stop (stretched title link); photo carousel arrows sit above the link overlay (`z-10`) with `aria-label`s; status (Sold/Reserved/New) as badges with text; price `tabular-nums`, AUD without cents.
- **Vehicle page**: gallery (keyboard: ←/→, visible "N photos" button, thumbnails as `aria-current` buttons), price block, primary CTA "Enquire", secondary Call / WhatsApp (only when a number is configured), finance estimate labelled *indicative only*, specs as a definition list, similar cars. No urgency or social-proof widgets.
- Photos: only the dealership's own uploads; a missing photo shows the neutral placeholder, never a stock image.

## 8. Public page patterns

Header (dark navy band, logo, Buy cars menu, primary links, phone, one accent CTA; skip link first) → `main#main` → footer (dark). Hero photography is decorative (`alt=""`, gradient for text contrast). Contact details, hours and address come only from Admin → Settings. Blog pages share the site frame and use `@tailwindcss/typography` (`prose`).

## 9. Admin / DMS patterns

- Dense and quiet: `bg-muted/40` canvas, white cards, tables over card grids, no decorative imagery or gradients.
- Navigation filtered by the role's permissions (convenience only — the server enforces access); active item `aria-current="page"`; skip link.
- Destructive/irreversible actions: `destructive` styling + ConfirmDialog stating the consequence.
- Money: AUD with cents, `tabular-nums`, totals right-aligned; drafts visibly marked DRAFT.

## 10. Invoice & email components

- **Invoice** (screen, print and PDF render from one view-model, `lib/invoices/document.ts`): title "Tax Invoice"/"Invoice", seller identity + ABN, bill-to, vehicle particulars, line table (GST-free lines marked `*`), totals block kept together across page breaks, payment details only as entered in Settings. A4, 10 mm print margins, table header repeats per page.
- **Email** (`lib/email/blocks.ts`): 600 px table layout, inline styles, Arial/Helvetica stack, navy buttons (≥ 44 px tall), real alt text, and an always-present footer (sender identity, contact details, reason for receiving, unsubscribe). Blocks: heading, paragraph, image, gallery, button, vehicle card, divider, spacer.

## 11. Responsive

Mobile-first. Breakpoints `sm 640 / md 768 / lg 1024 / xl 1280`. Touch targets ≥ 44 px. Filters collapse into a sheet with a sticky "Show N cars" button; the vehicle page gets a sticky price/CTA bar under `lg` (the WhatsApp float hides there).

## 12. Accessibility (WCAG 2.2 AA)

`lang="en-AU"`; visible focus ring everywhere (2 px `--ring`, never removed without replacement); contrast per §2; no information by colour alone; errors announced; focus moved to confirmations after a form succeeds; reduced motion honoured; every page has one `h1` and a skip link to `#main`.

## Don't

Gradients as decoration, glassmorphism, blobs/noise textures, sparkle icons, uppercase tracked eyebrows everywhere, repeated identical card grids, stock photos presented as the dealership, fake reviews/ratings/urgency, hex colours in components, `onClick` on non-interactive elements.
