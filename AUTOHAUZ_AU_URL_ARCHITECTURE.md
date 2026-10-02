# AUTOHAUZ_AU_URL_ARCHITECTURE

## Structure
- `/` - Homepage
- `/used-cars` - Master Inventory
- `/used-cars/[make]` - Make-specific Hub (e.g., `/used-cars/toyota`)
- `/used-cars/[make]/[model]` - Model-specific Hub (e.g., `/used-cars/toyota/rav4`)
- `/used-cars/[make]/[model]/[slug]` - Vehicle Detail Page (VDP)
- `/used-cars/body/[bodyType]` - Category Hub (e.g., `/used-cars/body/suv`)
- `/sell-your-car` - Acquisition
- `/trade-in` - Trade-in
- `/finance` - Finance
- `/blog` - Content Hub
- `/blog/category/[slug]` - Content Category
- `/blog/[slug]` - Article Page

## Parameters & Filters
- **Filter Strategy**: Inventory filters (`?make=`, `?model=`, `?price=`) on `/used-cars` are generally non-indexable dynamically generated states. High-volume, valuable combinations are mapped to clean path routes (`/used-cars/[make]/[model]`) to act as the primary indexable entities.

## Assessment
- **Status**: PASS. The URL architecture is clean, avoids excessive nesting, and maps directly to the entity hierarchy required for optimal vehicle SEO.
