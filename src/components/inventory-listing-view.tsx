import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { VehicleCard } from "@/components/vehicle-card";
import { UsedCarsFilters } from "@/components/used-cars-filters";
import { getVehicleListing, getMakes, getAllModels } from "@/lib/data/inventory";
import { parseVehicleSearchParams } from "@/lib/listing-params";
import type { VehicleFilters } from "@/lib/domain";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/json-ld";
import { itemListSchema } from "@/lib/seo/jsonld";

type SP = Record<string, string | string[] | undefined>;

/**
 * Shared faceted listing used by /used-cars and every pSEO landing page.
 * `baseFilters` are fixed by the route (e.g. make/body/budget) and merged over
 * the URL's query filters; `hideFilters` omits the locked dimension from the UI.
 */
export async function InventoryListingView({
  baseFilters,
  sp,
  basePath,
  hideFilters = [],
}: {
  baseFilters: Partial<VehicleFilters>;
  sp: SP;
  basePath: string;
  hideFilters?: ("make" | "body")[];
}) {
  const { filters, sort, page } = parseVehicleSearchParams(sp);
  const merged: VehicleFilters = { ...filters, ...baseFilters };
  const [listing, makes, allModels] = await Promise.all([
    getVehicleListing(merged, sort, page),
    getMakes(),
    getAllModels(),
  ]);
  const totalPages = Math.max(1, Math.ceil(listing.total / listing.perPage));

  return (
    <>
      {/* ItemList now carries each vehicle's name and image, and positions
          continue across pages (page 2 starts at 13, not 1) so Google reads one
          coherent collection rather than N lists that all start at position 1. */}
      {listing.items.length > 0 && (
        <JsonLd
          schema={itemListSchema(listing.items, {
            startPosition: (listing.page - 1) * listing.perPage + 1,
            total: listing.total,
          })}
        />
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">
          <aside className="sticky top-20 rounded-xl border border-border bg-card p-5">
            <UsedCarsFilters makes={makes} allModels={allModels} facets={listing.facets} hideFilters={hideFilters} />
          </aside>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {listing.total} {listing.total === 1 ? "car" : "cars"} {merged.status === "sold" ? "sold" : merged.status === "all" ? "found" : "available"}
            </p>
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="outline" size="sm" className="h-9" />}>
                  <SlidersHorizontal className="mr-2 size-4" /> Filters
                </SheetTrigger>
                <SheetContent side="left" className="w-full overflow-y-auto p-0 sm:max-w-sm">
                  <div className="p-6">
                    <SheetHeader className="px-0 pt-0 text-left">
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <UsedCarsFilters makes={makes} allModels={allModels} facets={listing.facets} hideFilters={hideFilters} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

        {listing.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <SlidersHorizontal className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">No cars match right now</p>
            <p className="mt-1 text-sm text-muted-foreground">Try widening your search or check back soon.</p>
            <Link href="/used-cars" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
              Browse all cars
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {listing.items.map((v, i) => (
                <VehicleCard key={v.id} vehicle={v} priority={i < 3} />
              ))}
            </div>
            {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} sp={sp} basePath={basePath} /> : null}
          </>
        )}
      </div>
    </div>
    </>
  );
}

function Pagination({ page, totalPages, sp, basePath }: { page: number; totalPages: number; sp: SP; basePath: string }) {
  const build = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      {/*
        rel=prev/next as discovery hints. Google retired them as an indexing
        signal in 2019 but Bing still consumes them, and they cost two tags.
        Next.js hoists <link> elements out of the body into <head>.
        `page - 1 === 1` drops the redundant `?page=1`, which would be a
        duplicate of the clean hub URL.
      */}
      {page > 1 && <link rel="prev" href={build(page - 1)} />}
      {page < totalPages && <link rel="next" href={build(page + 1)} />}

      <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
        {page > 1 ? (
          <Link
            href={build(page - 1)}
            rel="prev"
            aria-label={`Go to page ${page - 1}`}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Previous
          </Link>
        ) : null}
        <span className="px-2 text-sm text-muted-foreground" aria-current="page">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={build(page + 1)}
            rel="next"
            aria-label={`Go to page ${page + 1}`}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Next
          </Link>
        ) : null}
      </nav>
    </>
  );
}
