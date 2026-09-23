"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { inputClassName } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BODY_TYPE_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/nav";
import type { BodyType, FuelType, Make, Model, TransmissionType, VehicleListingResult } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Facets = VehicleListingResult["facets"];
type HiddenFilter = "make" | "body";

/** Every query key the sidebar controls; `sort` and `page` are deliberately not filters. */
export const FILTER_KEYS = [
  "status",
  "make",
  "model",
  "body",
  "fuel",
  "transmission",
  "price_min",
  "price_max",
  "year_min",
  "year_max",
  "km_max",
] as const;

/** Number of filters set in the URL, ignoring dimensions the route has locked. */
export function countActiveFilters(params: URLSearchParams, hidden: HiddenFilter[] = []): number {
  return FILTER_KEYS.filter((key) => {
    if (hidden.includes("make") && (key === "make" || key === "model")) return false;
    if (hidden.includes("body") && key === "body") return false;
    return Boolean(params.get(key));
  }).length;
}

/**
 * Faceted filters for the inventory listing — DESIGN.md §6/§9.
 *
 * Every change writes the URL (so results are shareable and the back button
 * works) and returns to page 1. Facets are single-select buttons with
 * `aria-pressed`; ranges commit on blur/Enter so typing "25000" doesn't fire
 * five navigations. The same component renders in the ≥ lg sidebar and in the
 * < lg sheet.
 */
export function UsedCarsFilters({
  makes,
  allModels = [],
  facets,
  hideFilters = [],
}: {
  makes: Make[];
  allModels?: Model[];
  facets: Facets;
  hideFilters?: HiddenFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const id = useId();

  const navigate = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page"); // any filter change returns to page 1
      const qs = next.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  const setParam = useCallback(
    (key: string, value: string | null) =>
      navigate((next) => {
        if (value == null || value === "") next.delete(key);
        else next.set(key, value);
      }),
    [navigate],
  );

  const get = (k: string) => params.get(k) ?? "";
  const activeCount = countActiveFilters(params, hideFilters);

  const selectedMake = makes.find((m) => m.slug === get("make"));
  const models = selectedMake ? allModels.filter((m) => m.makeId === selectedMake.id) : [];

  return (
    <div className={cn("space-y-6", pending && "opacity-70")} aria-busy={pending || undefined}>
      <FilterGroup id={`${id}-status`} label="Availability">
        <Select
          id={`${id}-status`}
          value={get("status") || "available"}
          onChange={(e) => setParam("status", e.target.value === "available" ? null : e.target.value)}
        >
          <option value="available">Available now</option>
          <option value="all">Available and sold</option>
          <option value="sold">Recently sold</option>
        </Select>
      </FilterGroup>

      {!hideFilters.includes("make") ? (
        <FilterGroup id={`${id}-make`} label="Make">
          <Select
            id={`${id}-make`}
            value={get("make")}
            onChange={(e) =>
              navigate((next) => {
                const value = e.target.value;
                if (value) next.set("make", value);
                else next.delete("make");
                next.delete("model"); // a model belongs to one make
              })
            }
          >
            <option value="">Any make</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </Select>
        </FilterGroup>
      ) : null}

      {!hideFilters.includes("make") && selectedMake && models.length > 0 ? (
        <FilterGroup id={`${id}-model`} label="Model">
          <Select id={`${id}-model`} value={get("model")} onChange={(e) => setParam("model", e.target.value || null)}>
            <option value="">Any {selectedMake.name} model</option>
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </Select>
        </FilterGroup>
      ) : null}

      {!hideFilters.includes("body") && facets.bodyType.length > 0 ? (
        <FacetGroup
          label="Body type"
          options={facets.bodyType.map((f) => ({ value: f.value, label: BODY_TYPE_LABELS[f.value as BodyType] ?? f.label, count: f.count }))}
          current={get("body")}
          onSelect={(v) => setParam("body", v)}
        />
      ) : null}

      {facets.fuelType.length > 0 ? (
        <FacetGroup
          label="Fuel"
          options={facets.fuelType.map((f) => ({ value: f.value, label: FUEL_LABELS[f.value as FuelType] ?? f.label, count: f.count }))}
          current={get("fuel")}
          onSelect={(v) => setParam("fuel", v)}
        />
      ) : null}

      {facets.transmission.length > 0 ? (
        <FacetGroup
          label="Transmission"
          options={facets.transmission.map((f) => ({
            value: f.value,
            label: TRANSMISSION_LABELS[f.value as TransmissionType] ?? f.label,
            count: f.count,
          }))}
          current={get("transmission")}
          onSelect={(v) => setParam("transmission", v)}
        />
      ) : null}

      <RangeGroup
        label="Price"
        from={{ id: `${id}-price-min`, label: "Minimum price", placeholder: "Min $", value: get("price_min"), onCommit: (v) => setParam("price_min", v) }}
        to={{ id: `${id}-price-max`, label: "Maximum price", placeholder: "Max $", value: get("price_max"), onCommit: (v) => setParam("price_max", v) }}
      />

      <RangeGroup
        label="Year"
        from={{ id: `${id}-year-min`, label: "Earliest year", placeholder: "From", value: get("year_min"), onCommit: (v) => setParam("year_min", v), maxLength: 4 }}
        to={{ id: `${id}-year-max`, label: "Latest year", placeholder: "To", value: get("year_max"), onCommit: (v) => setParam("year_max", v), maxLength: 4 }}
      />

      <FilterGroup id={`${id}-km`} label="Maximum kilometres">
        <NumberInput id={`${id}-km`} label="Maximum kilometres" placeholder="e.g. 80,000" value={get("km_max")} onCommit={(v) => setParam("km_max", v)} />
      </FilterGroup>

      {activeCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() =>
            navigate((next) => {
              for (const key of FILTER_KEYS) {
                if (hideFilters.includes("make") && (key === "make" || key === "model")) continue;
                if (hideFilters.includes("body") && key === "body") continue;
                next.delete(key);
              }
            })
          }
        >
          <X aria-hidden="true" />
          Clear {activeCount === 1 ? "filter" : `${activeCount} filters`}
        </Button>
      ) : null}
    </div>
  );
}

function FilterGroup({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function FacetGroup({
  label,
  options,
  current,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string; count: number }[];
  current: string;
  onSelect: (value: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-foreground">{label}</legend>
      <ul className="space-y-1">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <li key={o.value}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : o.value)}
                className={cn(
                  "flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-150",
                  active ? "bg-accent-soft font-semibold text-accent-soft-foreground" : "text-body hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{o.label}</span>
                <span className={cn("tabular text-xs", active ? "text-accent-soft-foreground" : "text-muted-foreground")}>{o.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

type NumberInputProps = {
  id: string;
  /** Accessible name (visually hidden inside a range pair). */
  label: string;
  placeholder: string;
  value: string;
  onCommit: (value: string | null) => void;
  maxLength?: number;
};

function RangeGroup({ label, from, to }: { label: string; from: NumberInputProps; to: NumberInputProps }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex items-center gap-2">
        <NumberInput {...from} />
        <span className="text-muted-foreground" aria-hidden="true">
          –
        </span>
        <NumberInput {...to} />
      </div>
    </fieldset>
  );
}

/** Digits-only text field that commits on blur or Enter (not on every keystroke). */
function NumberInput({ id, label, placeholder, value, onCommit, maxLength }: NumberInputProps) {
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // The URL changed underneath us (chip removed, "clear all"): adopt it.
    setLocal(value);
    setPrev(value);
  }
  const commit = () => {
    if (local !== value) onCommit(local || null);
  };
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={maxLength ?? 7}
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/\D+/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className={cn(inputClassName, "tabular")}
      />
    </>
  );
}
