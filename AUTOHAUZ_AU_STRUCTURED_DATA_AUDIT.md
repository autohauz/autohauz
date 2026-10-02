# AUTOHAUZ_AU_STRUCTURED_DATA_AUDIT

## 1. Global Entities
- **WebSite**: Rendered via `SiteEntityGraph` (`@id: WEBSITE_ID`). Provides site-wide context.
- **Organization**: Primary brand entity (`@id: ORGANIZATION_ID`). Safely omits `aggregateRating` (no fake reviews).
- **AutoDealer**: Physical location (`@id: LOCAL_BUSINESS_ID`). Linked to `Organization`.

## 2. Page Specific Entities
- **BreadcrumbList**: Built per-page, providing clear hierarchical paths for Google.
- **CollectionPage**: Associates listing pages (e.g., `/used-cars`) with the main entity.
- **ItemList**: Defines inventory grids as product collections (rather than raw link lists), enhancing rich snippet eligibility.
- **Car**: Rendered on VDPs. Links its internal `Offer` to the `AutoDealer` via `@id`, ensuring local business reputation signals cascade to vehicle offers.
- **FAQPage / Article**: Deployed conditionally on content pages.

## 3. Compliance
- **Rule Adherence**: The codebase explicitly checks for null/missing properties and omits the schema key entirely rather than outputting empty or fake strings.
- **Status**: PASS
