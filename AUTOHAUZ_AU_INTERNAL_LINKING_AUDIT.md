# AUTOHAUZ_AU_INTERNAL_LINKING_AUDIT

## 1. Top-Level Navigation
- The main header and footer provide clear paths to core conversion pages (`/used-cars`, `/finance`, `/sell-your-car`, `/contact`).

## 2. Listing to VDP
- The master inventory lists (`/used-cars`) provide high-authority links down to specific vehicle pages.
- Pagination is standard `<Link>` components, meaning Googlebot can crawl deep into inventory (not trapped behind client-side JS).

## 3. VDP Cross-Linking
- Breadcrumbs link upwards (`Make` and `Model` pages).
- "Similar Cars" section links laterally to contextually relevant alternative stock.
- Sold cars retain links to the parent model page (`See other [Make] [Model] listings`), ensuring link equity doesn't dead-end on a `noindex` page.

## 4. Assessment
- **Status**: PASS. The internal link graph naturally flows from authority hubs to individual vehicles without orphan pages.
