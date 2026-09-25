import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { VehicleCard } from "@/components/vehicle-card";
import { UsedCarsFilters } from "@/components/used-cars-filters";
import { ListingControls } from "@/components/listing/listing-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { JsonLd } from "@/components/json-ld";
import { itemListSchema } from "@/lib/seo/jsonld";
import { getVehicleListing, getMakes, getAllModels } from "@/lib/data/inventory";
import { parseVehicleSearchParams } from "@/lib/listing-params";
import { pageWindow } from "@/lib/pagination";
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS, formatKm, formatPrice } from "@/lib/nav";
import type { Make, Model, VehicleFilters } from "@/lib/domain";
import { cn } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;
type HiddenFilter = "make" | "body";

/**
 * Shared faceted listing used by /used-cars and every landing page.
 * `baseFilters` are fixed by the route (make / body / budget) and win over the
 * URL's query filters; `hideFilters` keeps the locked dimension out of the UI.
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
  hideFilters?: HiddenFilter[];
}) {
  const { filters, sort, page } = parseVehicleSearchParams(sp);
  const merged: VehicleFilters = { ...filters, ...baseFilters };
  const [listing, makes, allModels] = await Promise.all([getVehicleListing(merged, sort, page), getMakes(), getAllModels()]);
  const totalPages = Math.max(1, Math.ceil(listing.total / listing.perPage));
  const statusWord = merged.status === "sold" ? "recently sold" : merged.status === "all" ? "found" : "available";
  const chips = activeChips(sp, basePath, hideFilters, makes, allModels);
  const hasFilters = chips.length > 0;

  return (
    <>
      {/* ItemList positions continue across pages so Google reads one collection. */}
      {listing.items.length > 0 ? (
        <JsonLd
          schema={itemListSchema(listing.items, {
            startPosition: (listing.page - 1) * listing.perPage + 1,
            total: listing.total,
          })}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Filter cars" className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)] max-h-[calc(100dvh-var(--header-height)-3rem)] overflow-y-auto rounded-lg border border-border bg-card p-5">
            <h2 className="mb-5 text-base font-semibold">Filter</h2>
            <Suspense fallback={<div className="h-96 animate-pulse rounded bg-muted" />}>
              <UsedCarsFilters makes={makes} allModels={allModels} facets={listing.facets} hideFilters={hideFilters} />
            </Suspense>
          </div>
        </aside>

        <div className="min-w-0">
          <Suspense fallback={<div className="h-11 animate-pulse rounded bg-muted" />}>
            <ListingControls
              total={listing.total}
              statusWord={statusWord}
              sort={sort}
              makes={makes}
              allModels={allModels}
              facets={listing.facets}
              hideFilters={hideFilters}
            />
          </Suspense>

          {hasFilters ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <Link
                    href={chip.href}
                    scroll={false}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-sm bg-accent-soft py-1 pl-3 pr-2 text-sm font-medium text-accent-soft-foreground transition-colors hover:bg-azure-100/70"
                  >
                    <span className="sr-only">Remove filter: </span>
                    {chip.label}
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {chips.length > 1 ? (
                <li>
                  <Link href={basePath} scroll={false} className="inline-flex min-h-8 items-center px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                    Clear all
                  </Link>
                </li>
              ) : null}
            </ul>
          ) : null}

          {listing.items.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={hasFilters ? "No cars match those filters" : "No cars listed right now"}
              description={
                hasFilters
                  ? "Try removing a filter or widening the price and year range."
                  : "New stock is on its way. Tell us what you're after and we'll be in touch when it arrives."
              }
              action={hasFilters ? { label: "Clear all filters", href: basePath } : { label: "Tell us what you're after", href: "/contact" }}
              secondaryAction={hasFilters ? { label: "Tell us what you're after", href: "/contact" } : { label: "Browse all cars", href: "/used-cars" }}
            />
          ) : (
            <>
              {/* The sidebar's "Filter" h2 is hidden on mobile; this keeps h1 → h2 → card h3 in order. */}
              <h2 className="sr-only">Cars for sale</h2>
              <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-label={`${listing.total} cars`}>
                {listing.items.map((v, i) => (
                  <li key={v.id} className="flex">
                    <VehicleCard vehicle={v} priority={i < 3} className="w-full" />
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} sp={sp} basePath={basePath} /> : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Active-filter chips ───────────────────────────────────────────────────────

type Chip = { key: string; label: string; href: string };

const RANGE_KEYS = ["price_min", "price_max", "year_min", "year_max"] as const;

function str(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Build `basePath?…` without the given keys (and never with `page`). */
function without(sp: SP, basePath: string, keys: string[]): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v && k !== "page" && !keys.includes(k)) params.set(k, v);
  }
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

function activeChips(sp: SP, basePath: string, hidden: HiddenFilter[], makes: Make[], models: Model[]): Chip[] {
  const chips: Chip[] = [];
  const add = (key: string, label: string, remove: string[] = [key]) => chips.push({ key, label, href: without(sp, basePath, remove) });

  const status = str(sp, "status");
  if (status === "sold") add("status", "Recently sold");
  if (status === "all") add("status", "Including sold");

  if (!hidden.includes("make")) {
    const makeSlug = str(sp, "make");
    const make = makeSlug ? makes.find((m) => m.slug === makeSlug) : undefined;
    if (make) {
      const modelSlug = str(sp, "model");
      const model = modelSlug ? models.find((m) => m.makeId === make.id && m.slug === modelSlug) : undefined;
      add("make", model ? `${make.name} ${model.name}` : make.name, ["make", "model"]);
    }
  }

  if (!hidden.includes("body")) {
    const body = str(sp, "body");
    if (body) add("body", BODY_TYPE_LABELS[body as keyof typeof BODY_TYPE_LABELS] ?? body);
  }
  const fuel = str(sp, "fuel");
  if (fuel) add("fuel", FUEL_LABELS[fuel as keyof typeof FUEL_LABELS] ?? fuel);
  const transmission = str(sp, "transmission");
  if (transmission) add("transmission", TRANSMISSION_LABELS[transmission as keyof typeof TRANSMISSION_LABELS] ?? transmission);

  const [priceMin, priceMax, yearMin, yearMax] = RANGE_KEYS.map((k) => {
    const n = Number(str(sp, k));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });
  if (priceMin && priceMax) add("price", `${formatPrice(priceMin)} – ${formatPrice(priceMax)}`, ["price_min", "price_max"]);
  else if (priceMin) add("price", `From ${formatPrice(priceMin)}`, ["price_min"]);
  else if (priceMax) add("price", `Under ${formatPrice(priceMax)}`, ["price_max"]);

  if (yearMin && yearMax) add("year", `${yearMin} – ${yearMax}`, ["year_min", "year_max"]);
  else if (yearMin) add("year", `${yearMin} or newer`, ["year_min"]);
  else if (yearMax) add("year", `${yearMax} or older`, ["year_max"]);

  const km = Number(str(sp, "km_max"));
  if (Number.isFinite(km) && km > 0) add("km_max", `Under ${formatKm(km)}`);

  return chips;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, sp, basePath }: { page: number; totalPages: number; sp: SP; basePath: string }) {
  const build = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p)); // `?page=1` would duplicate the hub URL
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const item = "inline-flex size-10 items-center justify-center rounded-md border text-sm font-medium transition-colors";
  const idle = "border-border bg-card text-foreground hover:bg-muted";

  return (
    <>
      {/* rel=prev/next: retired by Google as an index signal, still read by Bing; Next hoists <link> into <head>. */}
      {page > 1 ? <link rel="prev" href={build(page - 1)} /> : null}
      {page < totalPages ? <link rel="next" href={build(page + 1)} /> : null}

      <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
        {page > 1 ? (
          <Link href={build(page - 1)} rel="prev" className={cn(item, idle, "px-3")}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
          </Link>
        ) : null}

        {pageWindow(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={cn(item, "tabular border-primary bg-primary text-primary-foreground")}>
              {p}
            </span>
          ) : (
            <Link key={p} href={build(p)} aria-label={`Page ${p}`} className={cn(item, idle, "tabular")}>
              {p}
            </Link>
          ),
        )}

        {page < totalPages ? (
          <Link href={build(page + 1)} rel="next" className={cn(item, idle, "px-3")}>
            <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
    </>
  );
}
