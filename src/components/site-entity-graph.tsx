import { JsonLd } from "@/components/json-ld";
import { getBusinessProfile } from "@/lib/data/business";
import { autoDealerSchema, organizationSchema, websiteSchema } from "@/lib/seo/jsonld";

/**
 * Site-wide entity graph — Organization, WebSite and AutoDealer nodes with
 * stable `@id`s that every page's own schema (Offers, ItemLists, breadcrumbs)
 * references. Rendered by the public layout and the homepage.
 *
 * Every business fact comes from `getBusinessProfile()` (Admin → Settings):
 * anything unset is simply omitted from the graph.
 */
export async function SiteEntityGraph() {
  const business = await getBusinessProfile();
  return <JsonLd schema={[organizationSchema(business), websiteSchema(), autoDealerSchema(business)]} />;
}
