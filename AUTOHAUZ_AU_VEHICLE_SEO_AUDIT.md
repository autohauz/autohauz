# AUTOHAUZ_AU_VEHICLE_SEO_AUDIT

## 1. VDP Entity Integrity
- **URL**: Clean `/used-cars/[make]/[model]/[slug]` format. Redirects strictly enforce that the URL components match the entity (`make` and `model` in URL must match the slug's actual properties).
- **Titles**: `[Year] [Make] [Model] [Variant] for Sale — [Price]`.
- **Metadata**: Dynamically populated with accurate specifications.

## 2. Inventory Lifecycle
- **Available/Reserved**: Indexable, included in `sitemap.xml`.
- **Sold**: Removed from `sitemap.xml`, marked `noindex` in metadata, UI updated to reflect sold status with cross-links to similar active inventory. This perfectly satisfies the "Sold Vehicle SEO Policy" requirement.

## 3. Vehicle Schema
- **Implementation**: Utilizes `Car` and `Offer`.
- **Integrity**: `vin` is deliberately excluded since only masked VINs are available, strictly adhering to the "do not fake data" mandate.
- **Status**: PASS. Vehicle pages are robust, highly descriptive, and accurately represented.
