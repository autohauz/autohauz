"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import type { Make, Model } from "@/lib/domain";
import { fetchModels } from "@/app/actions/inventory";
import { BUDGET_BANDS, NAV_BODY_TYPES, BODY_TYPE_LABELS } from "@/lib/nav";
import { Select } from "@/components/ui/select";

/**
 * Homepage search desk. Builds the same query-string the listing page reads
 * (`make`, `model`, `price_max`, `body`) so the URL is shareable and the
 * filters stay in sync. Models load when a make is chosen.
 */
export function HeroSearch({ makes }: { makes: Make[] }) {
  const router = useRouter();
  const id = useId();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, startLoadingModels] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoadingModels(async () => {
      const fetched = await fetchModels(make);
      if (!cancelled) setModels(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [make]);

  function onMakeChange(next: string) {
    setMake(next);
    setModel("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (maxPrice) params.set("price_max", maxPrice);
    if (bodyType) params.set("body", bodyType);
    const qs = params.toString();
    router.push(qs ? `/used-cars?${qs}` : "/used-cars");
  }

  // Premium Airbnb-style input styling
  const labelClass = "block text-[11px] font-bold text-neutral-800 px-4 mb-0.5 uppercase tracking-wider";
  const selectClass = "h-auto w-full cursor-pointer border-0 bg-transparent py-1 pl-4 pr-10 text-[15px] font-medium text-neutral-500 shadow-none outline-none ring-0 transition-colors focus:ring-0 focus-visible:ring-0 hover:text-neutral-900";

  return (
    <form 
      onSubmit={submit} 
      role="search" 
      aria-label="Search cars" 
      className="mx-auto flex w-full max-w-5xl flex-col items-center rounded-[2rem] bg-white p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5 transition-all lg:flex-row lg:rounded-full lg:pl-4"
    >
      <div className="flex w-full flex-col sm:flex-row lg:flex-1">
        <div className="group relative flex-1 cursor-pointer rounded-2xl p-2 transition-colors hover:bg-neutral-100 lg:rounded-full lg:p-3">
          <label htmlFor={`${id}-make`} className={labelClass}>Make</label>
          <Select id={`${id}-make`} name="make" value={make} onChange={(e) => onMakeChange(e.target.value)} className={selectClass}>
            <option value="">Any Make</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </Select>
        </div>

        {/* Divider */}
        <div className="hidden w-px self-center bg-neutral-200 lg:block lg:h-10" />

        <div className="group relative flex-1 cursor-pointer rounded-2xl p-2 transition-colors hover:bg-neutral-100 lg:rounded-full lg:p-3">
          <label htmlFor={`${id}-model`} className={labelClass}>Model</label>
          <Select id={`${id}-model`} name="model" value={model} onChange={(e) => setModel(e.target.value)} disabled={loadingModels} aria-busy={loadingModels} className={selectClass}>
            <option value="">{loadingModels ? "Loading…" : "Any Model"}</option>
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </Select>
          {loadingModels ? <Loader2 className="pointer-events-none absolute right-8 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        </div>
      </div>

      <div className="flex w-full flex-col sm:flex-row lg:flex-1">
        {/* Divider */}
        <div className="hidden w-px self-center bg-neutral-200 lg:block lg:h-10" />

        <div className="group relative flex-1 cursor-pointer rounded-2xl p-2 transition-colors hover:bg-neutral-100 lg:rounded-full lg:p-3">
          <label htmlFor={`${id}-price`} className={labelClass}>Price</label>
          <Select id={`${id}-price`} name="price_max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={selectClass}>
            <option value="">Any Price</option>
            {BUDGET_BANDS.map((b) => (
              <option key={b.max} value={b.max}>{b.label}</option>
            ))}
          </Select>
        </div>

        {/* Divider */}
        <div className="hidden w-px self-center bg-neutral-200 lg:block lg:h-10" />

        <div className="group relative flex-1 cursor-pointer rounded-2xl p-2 transition-colors hover:bg-neutral-100 lg:rounded-full lg:p-3">
          <label htmlFor={`${id}-body`} className={labelClass}>Body Type</label>
          <Select id={`${id}-body`} name="body" value={bodyType} onChange={(e) => setBodyType(e.target.value)} className={selectClass}>
            <option value="">Any Body</option>
            {NAV_BODY_TYPES.map((b) => (
              <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 w-full px-2 pb-2 lg:mt-0 lg:w-auto lg:p-0">
        <button
          type="submit"
          className="flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-[1.5rem] bg-accent px-10 text-[16px] font-bold text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] hover:bg-accent/90 active:scale-[0.98] lg:h-[68px] lg:w-auto lg:rounded-full"
        >
          <Search className="size-5 stroke-[2.5]" aria-hidden="true" />
          <span>Search</span>
        </button>
      </div>
    </form>
  );
}

