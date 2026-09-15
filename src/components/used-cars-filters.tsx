"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/nav";
import type { BodyType, FuelType, Make, Model, TransmissionType, VehicleListingResult } from "@/lib/domain";

type Facets = VehicleListingResult["facets"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "year_desc", label: "Year: Newest" },
  { value: "km_asc", label: "Kilometres: Lowest" },
  { value: "newest", label: "Recently added" },
];

export function UsedCarsFilters({
  makes,
  allModels = [],
  facets,
  hideFilters = [],
}: {
  makes: Make[];
  allModels?: Model[];
  facets: Facets;
  hideFilters?: ("make" | "body")[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      next.delete("page"); // any filter change returns to page 1
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const get = (k: string) => params.get(k) ?? "";
  const activeCount = ["status", "make", "model", "body", "fuel", "transmission", "price_min", "price_max", "year_min", "year_max", "km_max"].filter(
    (k) => params.get(k),
  ).length;

  const selectedMake = makes.find((m) => m.slug === get("make"));
  const selectedMakeId = selectedMake?.id;
  const filteredModels = allModels.filter((m) => m.makeId === selectedMakeId);

  return (
    <div className="space-y-6">
      {/* Sort */}
      <FilterGroup label="Sort by">
        <select
          value={get("sort") || "recommended"}
          onChange={(e) => setParam("sort", e.target.value === "recommended" ? null : e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FilterGroup>

      {/* Availability */}
      <FilterGroup label="Availability">
        <select
          value={get("status") || "available"}
          onChange={(e) => {
            const val = e.target.value;
            setParam("status", val === "available" ? null : val);
          }}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Cars</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
        </select>
      </FilterGroup>

      {/* Make */}
      {!hideFilters.includes("make") ? (
        <FilterGroup label="Make">
          <select
            value={get("make")}
            onChange={(e) => {
              const val = e.target.value || null;
              const next = new URLSearchParams(params.toString());
              if (val == null || val === "") next.delete("make");
              else next.set("make", val);
              next.delete("model"); // Always clear model when make changes!
              next.delete("page");
              const qs = next.toString();
              router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">All makes</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </FilterGroup>
      ) : null}

      {/* Model */}
      {!hideFilters.includes("make") && get("make") && filteredModels.length > 0 ? (
        <FilterGroup label="Model">
          <select
            value={get("model")}
            onChange={(e) => setParam("model", e.target.value || null)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">All models</option>
            {filteredModels.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
        </FilterGroup>
      ) : null}

      {/* Body type facets */}
      {!hideFilters.includes("body") && facets.bodyType.length > 0 ? (
        <FilterGroup label="Body type">
          <FacetList
            options={facets.bodyType.map((f) => ({ value: f.value, label: BODY_TYPE_LABELS[f.value as BodyType] ?? f.value, count: f.count }))}
            current={get("body")}
            onSelect={(v) => setParam("body", v)}
          />
        </FilterGroup>
      ) : null}

      {/* Fuel facets */}
      {facets.fuelType.length > 0 ? (
        <FilterGroup label="Fuel type">
          <FacetList
            options={facets.fuelType.map((f) => ({ value: f.value, label: FUEL_LABELS[f.value as FuelType] ?? f.value, count: f.count }))}
            current={get("fuel")}
            onSelect={(v) => setParam("fuel", v)}
          />
        </FilterGroup>
      ) : null}

      {/* Transmission facets */}
      {facets.transmission.length > 0 ? (
        <FilterGroup label="Transmission">
          <FacetList
            options={facets.transmission.map((f) => ({ value: f.value, label: TRANSMISSION_LABELS[f.value as TransmissionType] ?? f.value, count: f.count }))}
            current={get("transmission")}
            onSelect={(v) => setParam("transmission", v)}
          />
        </FilterGroup>
      ) : null}

      {/* Price range */}
      <FilterGroup label="Price ($)">
        <div className="flex items-center gap-2">
          <RangeInput placeholder="Min" value={get("price_min")} onCommit={(v) => setParam("price_min", v)} />
          <span className="text-muted-foreground">–</span>
          <RangeInput placeholder="Max" value={get("price_max")} onCommit={(v) => setParam("price_max", v)} />
        </div>
      </FilterGroup>

      {/* Year range */}
      <FilterGroup label="Year">
        <div className="flex items-center gap-2">
          <RangeInput placeholder="From" value={get("year_min")} onCommit={(v) => setParam("year_min", v)} />
          <span className="text-muted-foreground">–</span>
          <RangeInput placeholder="To" value={get("year_max")} onCommit={(v) => setParam("year_max", v)} />
        </div>
      </FilterGroup>

      {/* Max km */}
      <FilterGroup label="Max kilometres">
        <RangeInput placeholder="e.g. 80000" value={get("km_max")} onCommit={(v) => setParam("km_max", v)} />
      </FilterGroup>

      {activeCount > 0 ? (
        <button
          onClick={() => router.push(pathname, { scroll: false })}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <X className="size-4" /> Clear all filters
        </button>
      ) : null}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{label}</h3>
      {children}
    </div>
  );
}

function FacetList({
  options,
  current,
  onSelect,
}: {
  options: { value: string; label: string; count: number }[];
  current: string;
  onSelect: (value: string | null) => void;
}) {
  return (
    <ul className="space-y-1">
      {options.map((o) => {
        const active = current === o.value;
        return (
          <li key={o.value}>
            <button
              onClick={() => onSelect(active ? null : o.value)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                active ? "bg-primary text-black font-semibold shadow-sm" : "text-body hover:bg-muted font-medium"
              }`}
            >
              <span>{o.label}</span>
              <span className={`text-xs ${active ? "text-black/70" : "text-muted-foreground"}`}>{o.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RangeInput({
  placeholder,
  value,
  onCommit,
}: {
  placeholder: string;
  value: string;
  onCommit: (value: string | null) => void;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  
  if (value !== prevValue) {
    setLocal(value);
    setPrevValue(value);
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      placeholder={placeholder}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
    />
  );
}
