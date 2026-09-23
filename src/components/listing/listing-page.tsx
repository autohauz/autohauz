import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container, PageHeader } from "@/components/ui/container";
import { ListingBreadcrumbs, type Crumb } from "@/components/listing-breadcrumbs";
import { InventoryListingView } from "@/components/inventory-listing-view";
import { JsonLd } from "@/components/json-ld";
import { collectionPageSchema } from "@/lib/seo/jsonld";
import type { VehicleFilters } from "@/lib/domain";

type SP = Record<string, string | string[] | undefined>;

type ListingPageProps = {
  /** Page `<h1>`; the same string feeds the CollectionPage schema. */
  title: string;
  /** Meta description and the intro under the heading (kept identical on purpose). */
  description: string;
  /** Canonical path of this landing (no query string). */
  path: string;
  /** Breadcrumb trail below "Home". */
  trail: Crumb[];
  /** Filters fixed by the route (make, body type, budget). */
  baseFilters: Partial<VehicleFilters>;
  /** Filter dimensions the route locks and therefore hides from the sidebar. */
  hideFilters?: ("make" | "body")[];
  sp: SP;
  /** Optional block between the header and the grid (e.g. model chips on a make page). */
  children?: ReactNode;
};

/**
 * Shared frame for /used-cars and every programmatic landing page (make,
 * make + model, body type, budget). Routes decide *what* is listed; this
 * decides how the page is laid out so all five stay identical.
 */
export function ListingPage({ title, description, path, trail, baseFilters, hideFilters, sp, children }: ListingPageProps) {
  return (
    <>
      <JsonLd schema={collectionPageSchema({ name: title, description, path })} />
      <SiteHeader />
      <main id="main" className="py-8 lg:py-12">
        <Container>
          <PageHeader
            above={<ListingBreadcrumbs trail={trail} />}
            title={title}
            description={description}
            className="mb-8"
          />
          {children}
          <InventoryListingView baseFilters={baseFilters} sp={sp} basePath={path} hideFilters={hideFilters} />
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
