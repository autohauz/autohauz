import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbSchema } from "@/lib/seo/jsonld";

/**
 * A crumb: `[label, path]`. Every crumb carries its own path — including the
 * final one, which renders as plain text but still contributes its URL to the
 * BreadcrumbList so the trail Google sees is complete.
 */
export type Crumb = [label: string, path: string];

/**
 * Breadcrumb trail for inventory and landing pages.
 *
 * Replaces the three near-identical local `Breadcrumbs` helpers each listing
 * route defined for itself, and fixes two problems they all shared:
 *
 *  1. **No BreadcrumbList markup.** Only the vehicle detail page emitted
 *     breadcrumb JSON-LD, so Google rendered a bare URL instead of a
 *     `autohauz.com.au › Used Cars › Toyota` trail for every landing page.
 *     Rendering the trail here means publishing the markup is automatic.
 *  2. **Non-semantic markup.** The originals were a `<nav>` wrapping loose
 *     `<span>`s. This uses the project's existing (previously unused)
 *     `ui/breadcrumb` primitive — `<nav aria-label> › <ol> › <li>` with
 *     `aria-current="page"` — which is what assistive tech and crawlers parse
 *     as an actual hierarchy.
 *
 * "Home" is prepended automatically; callers pass only the trail below it.
 *
 * `suppressSchema` is for pages that already emit a BreadcrumbList inside a
 * larger `@graph` (the vehicle detail page bundles it with the Vehicle node).
 * Two BreadcrumbList blocks on one page is a structured-data error.
 */
export function ListingBreadcrumbs({
  trail,
  suppressSchema = false,
}: {
  trail: Crumb[];
  suppressSchema?: boolean;
}) {
  const crumbs: Crumb[] = [["Home", "/"], ...trail];
  const lastIndex = crumbs.length - 1;

  return (
    <>
      {suppressSchema ? null : (
        <JsonLd schema={breadcrumbSchema(crumbs.map(([name, path]) => ({ name, path })))} />
      )}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          {crumbs.map(([label, path], i) => (
            // Item and separator are siblings: both render <li>, and an <li>
            // inside an <li> is invalid HTML that forces a hydration re-render.
            <Fragment key={`${path}-${i}`}>
              <BreadcrumbItem>
                {i === lastIndex ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={path}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {i === lastIndex ? null : <BreadcrumbSeparator />}
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
