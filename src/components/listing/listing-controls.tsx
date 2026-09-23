"use client";

import { useId, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { UsedCarsFilters, countActiveFilters } from "@/components/used-cars-filters";
import type { Make, Model, VehicleListingResult, VehicleSort } from "@/lib/domain";

const SORT_OPTIONS: { value: VehicleSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Year: newest first" },
  { value: "km_asc", label: "Kilometres: lowest first" },
  { value: "newest", label: "Recently added" },
];

/**
 * The row above the results: live count, sort, and (below lg) the Filters
 * button that opens the sidebar in a sheet with a sticky "Show N cars" close.
 */
export function ListingControls({
  total,
  statusWord,
  sort,
  makes,
  allModels,
  facets,
  hideFilters,
}: {
  total: number;
  statusWord: string;
  sort: VehicleSort;
  makes: Make[];
  allModels: Model[];
  facets: VehicleListingResult["facets"];
  hideFilters?: ("make" | "body")[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const sortId = useId();
  const active = countActiveFilters(params, hideFilters);
  const noun = total === 1 ? "car" : "cars";

  const onSort = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "recommended") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-live="polite" className="text-sm text-body">
        <span className="tabular font-semibold text-foreground">{total.toLocaleString("en-AU")}</span> {noun} {statusWord}
      </p>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <label htmlFor={sortId} className="hidden text-sm text-body sm:block">
          Sort
        </label>
        <Select id={sortId} value={sort} onChange={(e) => onSort(e.target.value)} wrapperClassName="min-w-0 flex-1 sm:flex-none" className="sm:min-w-44" aria-label="Sort results">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" className="h-11 shrink-0 md:h-10 lg:hidden" />}>
            <SlidersHorizontal aria-hidden="true" />
            Filters
            {active > 0 ? (
              <span className="tabular rounded-full bg-accent-soft px-1.5 text-xs font-semibold text-accent-soft-foreground">
                <span className="sr-only">, </span>
                {active}
                <span className="sr-only"> active</span>
              </span>
            ) : null}
          </SheetTrigger>
          <SheetContent side="left" className="gap-0 p-0 data-[side=left]:w-full data-[side=left]:sm:max-w-sm">
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="text-lg font-semibold">Filters</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <UsedCarsFilters makes={makes} allModels={allModels} facets={facets} hideFilters={hideFilters} />
            </div>
            <div className="border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button type="button" size="cta" className="w-full" onClick={() => setOpen(false)}>
                Show {total.toLocaleString("en-AU")} {noun}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
