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

  const labelClass = "block text-[11px] font-bold text-[#111827] px-3 mb-1 uppercase tracking-wide";
  const selectClass = "h-auto w-full border-0 bg-transparent py-1 pl-3 pr-8 text-[15px] text-[#4b5563] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

  return (
    <form 
      onSubmit={submit} 
      role="search" 
      aria-label="Search cars" 
      className="flex flex-col lg:flex-row w-full max-w-5xl items-center rounded-2xl lg:rounded-[100px] bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#e5e7eb]"
    >
      <div className="flex w-full flex-col sm:flex-row">
        <div className="flex-1 py-3 lg:py-2 border-b sm:border-b-0 sm:border-r border-[#e5e7eb]">
          <label htmlFor={`${id}-make`} className={labelClass}>Make</label>
          <Select id={`${id}-make`} name="make" value={make} onChange={(e) => onMakeChange(e.target.value)} className={selectClass}>
            <option value="">Any Make</option>
            {makes.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </Select>
        </div>

        <div className="flex-1 py-3 lg:py-2 relative border-b sm:border-b-0 lg:border-r border-[#e5e7eb]">
          <label htmlFor={`${id}-model`} className={labelClass}>Model</label>
          <Select id={`${id}-model`} name="model" value={model} onChange={(e) => setModel(e.target.value)} disabled={loadingModels} aria-busy={loadingModels} className={selectClass}>
            <option value="">{loadingModels ? "Loading models…" : "Any Model"}</option>
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </Select>
          {loadingModels ? <Loader2 className="pointer-events-none absolute right-8 top-1/2 size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        </div>
      </div>

      <div className="flex w-full flex-col sm:flex-row lg:border-r border-[#e5e7eb]">
        <div className="flex-1 py-3 lg:py-2 border-b sm:border-b-0 sm:border-r border-[#e5e7eb]">
          <label htmlFor={`${id}-price`} className={labelClass}>Price</label>
          <Select id={`${id}-price`} name="price_max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={selectClass}>
            <option value="">Any Price</option>
            {BUDGET_BANDS.map((b) => (
              <option key={b.max} value={b.max}>{b.label}</option>
            ))}
          </Select>
        </div>

        <div className="flex-1 py-3 lg:py-2 lg:border-r-0 lg:pr-2">
          <label htmlFor={`${id}-body`} className={labelClass}>Body Type</label>
          <Select id={`${id}-body`} name="body" value={bodyType} onChange={(e) => setBodyType(e.target.value)} className={selectClass}>
            <option value="">Any Body Type</option>
            {NAV_BODY_TYPES.map((b) => (
              <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>
            ))}
          </Select>
        </div>
      </div>

      <button
        type="submit"
        className="mt-4 lg:mt-0 flex h-14 lg:h-[60px] w-full lg:w-auto shrink-0 items-center justify-center gap-2 rounded-xl lg:rounded-[100px] bg-accent px-8 text-[15px] font-bold text-accent-foreground transition-colors hover:bg-accent/90"
      >
        <Search className="size-5 stroke-[2.5]" aria-hidden="true" />
        Search Cars
      </button>
    </form>
  );
}
