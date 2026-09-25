# AutoHauz — Design / UI-UX Audit

Scope: public site and staff back office, against [`DESIGN.md`](../DESIGN.md) (the visual source of truth written during this audit from the tokens already in `src/app/globals.css`). Method: source review, screenshots of a production build at 390 px and 1920 px, contrast computed with the WCAG formula.

Principle applied throughout: **no redesign first**. The existing navy/azure identity, Archivo type and component set were kept; fixes remove what undermines trust (fabrication, noise, broken states) and make the existing system consistent.

## Fixed

| ID | Area | Observed | Fix | Evidence |
|---|---|---|---|---|
| UI-01 | Trust | Homepage "Google reviews" block with invented ratings/quotes and the Google logo; dashboard "[DEMO MODE]" numbers | Real data only; section hidden without genuine reviews; dashboard counts from the DB | R |
| UI-02 | Trust | Unsplash stock photos presented as the dealership's own cars | External image URLs render the neutral "photo coming soon" artwork | R |
| UI-03 | Conversion | WhatsApp pill white-on-green 1.98:1 and covering the vehicle page CTA | Solid `#075E54` (7.5:1); hidden on vehicle pages, which carry their own WhatsApp button | R (screenshots) |
| UI-04 | Conversion | Vehicle page Call/WhatsApp buttons missing (phone read from a different settings key) | One business-profile source | R |
| UI-05 | Noise | framer-motion scroll reveals, sparkle icons, noise texture, hover lifts; content `opacity:0` until hydration | Removed; content visible in server HTML | R |
| UI-06 | Hierarchy | Hero CTA white on `#0A7AF5` (4.11:1); small azure eyebrows on navy (~4.4:1) | Accent token (5.6:1); `azure-300` on dark (~7:1) | computed |
| UI-07 | Consistency | Phone shown as `+61492962418` in header, CTAs, footer | `formatPhoneForDisplay` → `0492 962 418`; `tel:` keeps E.164 | R |
| UI-08 | States | Gallery "View photo" button overlapping the placeholder caption | Lightbox control only when real photos exist | R (390 px screenshot) |
| UI-09 | Footer | Duplicate footers, `#` links, a live Google Map iframe on every page | Single footer from Settings, directions link, no dead links | R |
| UI-10 | Contact | Map iframe loaded on arrival (third-party cookie) and a hard-coded short link | Click-to-load map; link from the configured address | R |
| UI-11 | Admin safety | Instant publish from a row `<select>`; 3-second double-click delete | ConfirmDialog stating the consequence | T, S |
| UI-12 | Admin nav | No skip link; menu toggle without state; nav unfiltered by role | Skip link, `aria-expanded`, permission-filtered nav with `aria-current` | S |
| UI-13 | Invoices | Hard-coded Westpac line on every invoice; tax invoice printable without ABN; single GST flag | Payment details from Settings only; ABN required; per-line GST; one view-model for screen/print/PDF | T, PDF visual check |
| UI-14 | Email | Template/campaign forms with raw HTML and a fake unsubscribe | Block builder (heading, text, image, gallery, button, vehicle card…) with a fixed compliance footer | T |
| UI-15 | Typography | Sub-12 px text in admin badges, roles metadata, MFA secret; black text on the navy "cover" badge (~1.8:1) | ≥ 12 px (`text-xs`), MFA secret 14 px, `text-primary-foreground` on navy | S |
| UI-16 | Sign-in | Navy logo on navy, marketing claims shown to staff, heading order | Dark logo variant, staff copy, one `h1` | R |
| UI-17 | Newsletter | Confirmshaming unsubscribe copy, page outside the site frame | Neutral copy; header/footer | R |
| UI-18 | Dates | Invoice dates mixed `09 Oct` / `25 Sept` | `d MMM yyyy` per DESIGN.md | PDF visual check |

## Open

| ID | Sev | Observed | Recommendation |
|---|---|---|---|
| UI-20 | P3 | Hex colours in `className` in 10 public files (e.g. hero search label `#111827`, gallery arrows `#0a0f1d`, promo/difference sections, footer) | Replace with semantic tokens (`text-foreground`, `bg-navy-950`); DESIGN.md forbids hex in components |
| UI-21 | P3 | Ad-hoc pixel font sizes (`text-[13px]`, `text-[14px]`, `text-[15px]`…) ~40 uses, mostly footer/home sections | Map to the type scale (`text-sm`, `text-base`) |
| UI-22 | P3 | Uppercase tracked eyebrow labels in 10 files | DESIGN.md "Don't": keep for at most one label style |
| UI-23 | P3 | Decorative gradients in 7 files (some are hero text-contrast overlays, which are allowed) | Keep contrast overlays; remove purely decorative ones |
| UI-24 | P2 | No real vehicle photography (all 6 listings show the placeholder) | Owner to upload real photos; this is the single biggest visual-quality lever |
| UI-25 | P3 | Admin screens not reviewed visually at runtime (no staff credentials) | Visual pass once an account is available |
| UI-26 | P4 | Archivo width axis costs ~60 KB of font for the wide-heading effect | Owner decision (brand vs weight) |

## Responsive checks performed

`scrollWidth === innerWidth` (no horizontal overflow) verified in a production build at **390 px** on `/`, `/used-cars`, a vehicle page, `/finance`, `/contact`, `/sell-your-car`, and at **768 px** on `/`, `/used-cars` and a vehicle page; desktop 1920 px screenshots of the vehicle page. Sticky price/CTA bar present under `lg`; mobile menu rows 44–48 px. Not checked: 1024–1280 px breakpoints and landscape phones.
