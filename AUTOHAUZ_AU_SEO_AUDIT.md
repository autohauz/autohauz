# AUTOHAUZ_AU_SEO_AUDIT

## 1. Scope
Initial Technical SEO Audit of the AutoHauz App Router repository, evaluating alignment with the Australian SEO Master Specification.

## 2. Next.js Architecture
- **Framework**: Next.js App Router (v14+).
- **Rendering**: Static generation + On-demand ISR (`export const revalidate`).
- **Metadata**: Next.js Metadata API is natively used. Canonical URLs and OG tags are properly centralized via `src/lib/seo/metadata.ts`.
- **Status**: PASS

## 3. Crawlability & Indexation
- **Robots.txt**: Exists natively (`src/app/robots.ts`). Excludes `/admin`, `/api`. Explicitly blocks AI training scrapers while allowing AI Search bots.
- **Sitemap.xml**: Dynamically generated (`src/app/sitemap.ts`). Automatically excludes sold vehicles. Limits indexation to routes with valid inventory sizes to prevent thin content bloat.
- **Sold Vehicles**: Retained on canonical paths with `noindex` headers to retain inbound traffic but prevent Google from indexing stale inventory.
- **Status**: PASS

## 4. Vehicle SEO (VDP)
- **Metadata**: Generates precise titles (`[Year] [Make] [Model] for Sale — [Price]`) and descriptions omitting spammy modifiers.
- **Schema**: Valid `Car` and `Offer` JSON-LD rendered conditionally based on strict database constraints (no invented schema fields).
- **Status**: PASS

## 5. Local Business SEO
- **Schema**: `AutoDealer` JSON-LD correctly implemented inside `src/lib/seo/jsonld.ts` with strict checks for real configuration (only publishes addresses if a real one exists in the DB).
- **Status**: PASS

## 6. Findings
- **P0**: None. The foundational technical SEO is immaculate.
- **P2**: URL Architecture / Internal Linking strategy needs mapping.
- **P3**: Content gaps for local Australian search intents (Finance, Trade-in) need validation.

## 7. Next Steps
Generate the Keyword Map, URL Architecture, and Indexation Map.
