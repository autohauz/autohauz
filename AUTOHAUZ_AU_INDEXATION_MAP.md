# AUTOHAUZ_AU_INDEXATION_MAP

| URL Type | Index | Canonical | Sitemap | Reason |
| :--- | :--- | :--- | :--- | :--- |
| `/` | YES | Self | YES | Core business page |
| `/used-cars` | YES | Self | YES | Core inventory hub |
| `/used-cars/[make]` | Dynamic | Self | Dynamic | Gated by `isIndexableLanding`. Prevents thin content bloat. |
| `/used-cars/[make]/[model]` | Dynamic | Self | Dynamic | Gated by `isIndexableLanding`. Prevents thin content bloat. |
| `/used-cars/[make]/[model]/[slug]` (Available) | YES | Self | YES | Active inventory. |
| `/used-cars/[make]/[model]/[slug]` (Sold) | NO | Self | NO | Expired inventory. Retained for UX/Links, but removed from Google Index. |
| `/blog/[slug]` | YES | Self | YES | Informational content. |
| `/finance` | YES | Self | YES | Core service page. |
| `/trade-in` | YES | Self | YES | Core service page. |
| `/sell-your-car` | YES | Self | YES | Core service page. |
| `/admin/*` | NO | — | NO | Private dashboard. |
| `/api/*` | NO | — | NO | API Routes. |
| `/?sort=*` | NO | `/used-cars` | NO | Parameterized sorting. |
