# AUTOHAUZ_AU_LOCAL_SEO_AUDIT

## 1. NAP Consistency (Name, Address, Phone)
- **Status**: Dynamic and Data-Driven.
- **Analysis**: AutoHauz fetches business configurations directly from the backend (`src/lib/data/settings.ts`). The `AutoDealer` schema in `src/lib/seo/jsonld.ts` strictly outputs an address *only* if `hasAddress` resolves to true. Phone numbers and social links are centralized.
- **Result**: No fake or mismatched local addresses will be rendered.

## 2. Location Pages
- **Status**: Unimplemented / Not Applicable.
- **Analysis**: The site operates primarily as a single Australian entity. There are no doorway pages or programmatic "Used Cars Sydney", "Used Cars Melbourne" pages.
- **Recommendation**: (P4) If AutoHauz establishes specific physical yards in multiple states, genuine location landing pages could be considered. Currently, creating them without physical footprint violates the SEO master rules.

## 3. Google Business Profile Support
- **Schema Linkage**: `AutoDealer` is correctly configured with `parentOrganization` linking to the primary brand. The schema outputs precisely the fields GBP relies on (opening hours formatting is compliant with schema.org standards using `Mo`, `Tu`, etc).
- **Status**: PASS
