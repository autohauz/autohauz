# AUTOHAUZ_AU_KEYWORD_MAP

## Intent Mapping
### 1. Transactional
- **Keywords**: "used cars", "used cars for sale", "used SUVs", "used utes", "used 4WD"
- **Target URL**: `/used-cars`, `/used-cars/body/suv`, `/used-cars/body/ute`
- **Indexable**: Yes
- **Canonical**: Self

### 2. Vehicle-Model Intent
- **Keywords**: "Toyota RAV4 for sale", "Ford Ranger used", "Mazda CX-5 used"
- **Target URL**: `/used-cars/[make]/[model]`
- **Indexable**: Yes (if sufficient inventory exists, gated by `isIndexableLanding`)
- **Canonical**: Self

### 3. Local Transactional
- **Keywords**: "used cars [Australian Location]", "used Toyota [Location]"
- **Target URL**: Not currently explicitly mapped to dynamic routes. (P3 Gap - depends on actual dealership footprint).

### 4. Commercial Investigation
- **Keywords**: "best used SUV", "reliable used car", "used car buying guide"
- **Target URL**: `/blog/category/guides`, `/blog/[slug]`
- **Indexable**: Yes
- **Canonical**: Self

### 5. Finance
- **Keywords**: "car finance", "used car finance", "car loan information"
- **Target URL**: `/finance`
- **Indexable**: Yes
- **Canonical**: Self

### 6. Trade-in / Sell
- **Keywords**: "trade in car", "sell my car", "car valuation"
- **Target URL**: `/trade-in`, `/sell-your-car`
- **Indexable**: Yes
- **Canonical**: Self
