"use client";

import { useActionState, useState, useRef } from "react";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fuelTypes, transmissionTypes, bodyTypes, driveTypes, vehicleStatuses } from "@/lib/validation/vehicle";
import { FUEL_LABELS, TRANSMISSION_LABELS, BODY_TYPE_LABELS, DRIVE_LABELS } from "@/lib/nav";
import type { Make, Model, Feature, LocationBranch, FeatureCategory } from "@/lib/domain";
import { ChevronRight, ChevronLeft, Car, Gauge, DollarSign, Star, Image as ImageIcon, Loader2, Check as CheckIcon, Trash2 } from "lucide-react";
import { ImageUpload, UploadedImage } from "./image-upload";
import { createMake, createModel } from "@/app/admin/catalogue/actions";

type ActionResult = { ok?: boolean; error?: string } | void;
type Action = (state: ActionResult, formData: FormData) => Promise<ActionResult>;

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow";

// A vehicle row (snake_case) for edit mode, loosely typed.
type VehicleData = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const STEPS = [
  { value: "basics",   label: "Basics",         icon: Car },
  { value: "specs",    label: "Specs",          icon: Gauge },
  { value: "pricing",  label: "Pricing",        icon: DollarSign },
  { value: "features", label: "Features",       icon: Star },
  { value: "images",   label: "Images & Notes", icon: ImageIcon },
] as const;

type StepValue = (typeof STEPS)[number]["value"];

export function VehicleForm({
  action,
  makes: initialMakes,
  models: initialModels,
  features,
  locations,
  vehicle,
  selectedFeatureIds = [],
  mode,
}: {
  action: Action;
  makes: Make[];
  models: Model[];
  features: Feature[];
  locations: LocationBranch[];
  vehicle?: VehicleData;
  selectedFeatureIds?: string[];
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  
  // Local state for dynamic Makes/Models
  const [makes, setMakes] = useState<Make[]>(initialMakes);
  const [models, setModels] = useState<Model[]>(initialModels);
  
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimeoutRef = useRef<NodeJS.Timeout>(null);

  const v = vehicle ?? {};

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    } else {
      const { deleteVehicle } = await import("@/app/admin/inventory/actions");
      // Pass shouldRedirect=false: calling redirect() inside a Server Action
      // that is invoked directly from a client component (not via a form action)
      // throws a Next.js internal error that propagates back to the client as an
      // unhandled rejection, crashing the component and triggering the error
      // boundary. Let the client handle navigation instead.
      const res = await deleteVehicle(v.id, false);
      if (res?.error) {
        toast.error("Failed to delete vehicle: " + res.error);
      } else {
        toast.success("Vehicle deleted successfully");
        router.push('/admin/inventory');
      }
    }
  };

  const [makeId, setMakeId] = useState<string>(vehicle?.make_id ?? "");
  const [modelId, setModelId] = useState<string>(vehicle?.model_id ?? "");
  const [activeTab, setActiveTab] = useState<StepValue>("basics");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Inline creation states
  const [isAddingMake, setIsAddingMake] = useState(false);
  const [newMakeName, setNewMakeName] = useState("");
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [isCreatingInline, setIsCreatingInline] = useState(false);

  // Transform existing images if in edit mode. Be defensive about shape: a row
  // whose media join came back null must not blow up the whole form — skip it.
  const initialImages: UploadedImage[] = (v.images || [])
    .map((img: { media?: { storage_key?: string; url?: string } | null; url?: string; is_cover?: boolean }) => {
      const path = img.media?.storage_key ?? "";
      const url = img.media?.url || img.url || "";
      if (!path && !url) return null;
      return { path, url, isCover: Boolean(img.is_cover) };
    })
    .filter((x: UploadedImage | null): x is UploadedImage => x !== null);

  const modelsForMake = models.filter((m) => m.makeId === makeId);
  const featureGroups = (["comfort", "safety", "technology", "exterior"] as FeatureCategory[])
    .map((cat) => ({ cat, items: features.filter((f) => f.category === cat) }));

  const currentIndex = STEPS.findIndex((s) => s.value === activeTab);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STEPS.length - 1;

  function validateCurrentStep(): boolean {
    if (!formRef.current) return true;
    const panel = formRef.current.querySelector(`[data-step="${activeTab}"]`);
    if (panel) {
      const inputs = panel.querySelectorAll('input[required], select[required], textarea[required]');
        const formElements = Array.from(inputs) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
        for (const input of formElements) {
          if (!input.checkValidity()) {
            input.reportValidity();
            return false; // Stop and show HTML5 error on the specific input
          }
        }
    }
    return true;
  }

  function goNext() {
    if (validateCurrentStep() && !isLast) {
      setActiveTab(STEPS[currentIndex + 1].value);
    }
  }
  
  function goPrev() {
    if (!isFirst) setActiveTab(STEPS[currentIndex - 1].value);
  }

  async function handleAddMake() {
    if (!newMakeName.trim()) return;
    setIsCreatingInline(true);
    const fd = new FormData();
    fd.append("name", newMakeName);
    const res = await createMake(null, fd);
    if (res.ok && res.id) {
      setMakes([...makes, { id: res.id, name: newMakeName.trim(), slug: "", isPopular: false }]);
      setMakeId(res.id);
      setIsAddingMake(false);
      setNewMakeName("");
      toast.success("Make added successfully");
    } else {
      toast.error(res.error || "Failed to create make");
    }
    setIsCreatingInline(false);
  }

  async function handleAddModel() {
    if (!newModelName.trim() || !makeId) return;
    setIsCreatingInline(true);
    const fd = new FormData();
    fd.append("name", newModelName);
    fd.append("makeId", makeId);
    const res = await createModel(null, fd);
    if (res.ok && res.id) {
      setModels([...models, { id: res.id, makeId, name: newModelName.trim(), slug: "" }]);
      setModelId(res.id);
      setIsAddingModel(false);
      setNewModelName("");
      toast.success("Model added successfully");
    } else {
      toast.error(res.error || "Failed to create model");
    }
    setIsCreatingInline(false);
  }

  // Intercept form submission to validate all fields (especially for edit mode where tabs can be skipped)
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (mode === "create" && !validateCurrentStep()) {
      e.preventDefault();
      return;
    }
    
    // In edit mode, if they click save but a hidden tab is invalid, find it and switch to it
    if (mode === "edit" && formRef.current && !formRef.current.checkValidity()) {
      e.preventDefault();
      const firstInvalid = formRef.current.querySelector(':invalid');
      if (firstInvalid) {
        const panel = firstInvalid.closest('[data-step]');
        if (panel) {
          const stepValue = panel.getAttribute('data-step') as StepValue;
          setActiveTab(stepValue);
          setTimeout(() => (firstInvalid as HTMLElement).focus(), 100);
        }
      }
    }
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {mode === "edit" ? <input type="hidden" name="id" value={v.id} /> : null}

      {/* Step progress bar — create mode only */}
      {mode === "create" && (
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = step.value === activeTab;
            const isDone = i < currentIndex;
            return (
              <div key={step.value} className="flex flex-1 items-center">
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isDone
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckIcon className="size-3.5 shrink-0" />
                  ) : (
                    <Icon className="size-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 transition-colors ${i < currentIndex ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => {
        if (mode === "edit") setActiveTab(v as StepValue);
        // In create mode, we disable clicking tabs directly to enforce the wizard flow
      }}>
        {/* Tab list — edit mode only (create mode uses the step bar above) */}
        {mode === "edit" && (
          <TabsList>
            {STEPS.map((s) => (
              <TabsTab key={s.value} value={s.value}>{s.label}</TabsTab>
            ))}
          </TabsList>
        )}

        <TabsPanel value="basics" data-step="basics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <L label="Stock ID *"><input name="stockId" required defaultValue={v.stock_id} disabled={mode === "edit"} className={inputCls} placeholder="A1042" /></L>
            <L label="Year *"><input name="year" required type="number" defaultValue={v.year} className={inputCls} /></L>
            
            <L label="Make *">
              {!isAddingMake ? (
                <>
                  <select name="makeId" required value={makeId} onChange={(e) => {
                    if (e.target.value === "new") setIsAddingMake(true);
                    else {
                      setMakeId(e.target.value);
                      setModelId(""); // reset model when make changes
                    }
                  }} className={inputCls}>
                    <option value="">Select make…</option>
                    {makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    <option value="new" className="font-semibold text-primary">+ Add New Make...</option>
                  </select>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="hidden" name="makeId" value={makeId} />
                  <input autoFocus placeholder="New make name" value={newMakeName} onChange={(e) => setNewMakeName(e.target.value)} className={inputCls} />
                  <button type="button" disabled={isCreatingInline} onClick={handleAddMake} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Save</button>
                  <button type="button" onClick={() => setIsAddingMake(false)} className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Cancel</button>
                </div>
              )}
            </L>

            <L label="Model *">
              {!isAddingModel ? (
                <select name="modelId" required value={modelId} onChange={(e) => {
                  if (e.target.value === "new") setIsAddingModel(true);
                  else setModelId(e.target.value);
                }} className={inputCls} disabled={!makeId || isAddingMake}>
                  <option value="">Select model…</option>
                  {modelsForMake.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  {makeId && <option value="new" className="font-semibold text-primary">+ Add New Model...</option>}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="hidden" name="modelId" value={modelId} />
                  <input autoFocus placeholder="New model name" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} className={inputCls} />
                  <button type="button" disabled={isCreatingInline} onClick={handleAddModel} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Save</button>
                  <button type="button" onClick={() => setIsAddingModel(false)} className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Cancel</button>
                </div>
              )}
            </L>
            <L label="Variant"><input name="variant" defaultValue={v.variant ?? ""} className={inputCls} placeholder="GXL" /></L>
            <L label="Mileage (km) *"><input name="mileageKm" required type="number" defaultValue={v.mileage_km} className={inputCls} /></L>
            <L label="Status">
              <select name="status" defaultValue={v.status ?? "draft"} className={inputCls}>
                {vehicleStatuses.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </L>
            <L label="Location">
              <select name="locationId" defaultValue={v.location_id ?? ""} className={inputCls}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
              </select>
            </L>
          </div>
        </TabsPanel>

        <TabsPanel value="specs" data-step="specs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <L label="Fuel *"><select name="fuelType" required defaultValue={v.fuel_type ?? fuelTypes[0]} className={inputCls}>{fuelTypes.map((f) => <option key={f} value={f}>{FUEL_LABELS[f]}</option>)}</select></L>
            <L label="Transmission *"><select name="transmission" required defaultValue={v.transmission ?? transmissionTypes[0]} className={inputCls}>{transmissionTypes.map((t) => <option key={t} value={t}>{TRANSMISSION_LABELS[t]}</option>)}</select></L>
            <L label="Body type *"><select name="bodyType" required defaultValue={v.body_type ?? bodyTypes[0]} className={inputCls}>{bodyTypes.map((b) => <option key={b} value={b}>{BODY_TYPE_LABELS[b]}</option>)}</select></L>
            <L label="Drive"><select name="driveType" defaultValue={v.drive_type ?? ""} className={inputCls}><option value="">—</option>{driveTypes.map((d) => <option key={d} value={d}>{DRIVE_LABELS[d]}</option>)}</select></L>
            <L label="Engine"><input name="engine" defaultValue={v.engine ?? ""} className={inputCls} placeholder="2.0L 4-cyl turbo" /></L>
            <L label="Power (kW)"><input name="powerKw" type="number" defaultValue={v.power_kw ?? ""} className={inputCls} /></L>
            <L label="Seats"><input name="seats" type="number" defaultValue={v.seats ?? ""} className={inputCls} /></L>
            <L label="Doors"><input name="doors" type="number" defaultValue={v.doors ?? ""} className={inputCls} /></L>
            <L label="Exterior colour"><input name="exteriorColor" defaultValue={v.exterior_color ?? ""} className={inputCls} /></L>
            <L label="Interior"><input name="interior" defaultValue={v.interior ?? ""} className={inputCls} /></L>
            <L 
              label="VIN" 
              hint="Crucial for syndication. Without a valid 17-character VIN, this vehicle will be rejected by Google and Meta."
            >
              <input name="vin" defaultValue={v.vin ?? ""} className={inputCls} maxLength={17} />
            </L>
            <L label="Registration"><input name="registration" defaultValue={v.registration ?? ""} className={inputCls} /></L>
            <L label="Rego expiry"><input name="regoExpiry" type="date" defaultValue={v.rego_expiry ?? ""} className={inputCls} /></L>
            <L label="Safety rating"><input name="safetyRating" defaultValue={v.safety_rating ?? ""} className={inputCls} placeholder="5-star ANCAP" /></L>
          </div>
        </TabsPanel>

        <TabsPanel value="pricing" data-step="pricing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <L label="Price ($) *"><input name="price" required type="number" step="0.01" defaultValue={v.price} className={inputCls} /></L>
            <L label="Weekly estimate ($)"><input name="weeklyEstimate" type="number" defaultValue={v.weekly_estimate ?? ""} className={inputCls} placeholder="auto if blank" /></L>
            <L label="Warranty"><input name="warrantyText" defaultValue={v.warranty_text ?? ""} className={inputCls} placeholder="3-month dealer warranty" /></L>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            <Check name="roadworthyIncluded" label="Roadworthy included" defaultChecked={v.roadworthy_included ?? false} />
            <Check name="financeAvailable" label="Finance available" defaultChecked={v.finance_available ?? true} />
            <Check name="tradeInWelcome" label="Trade-in welcome" defaultChecked={v.trade_in_welcome ?? true} />
            <Check name="inspectionAvailable" label="Inspection available" defaultChecked={v.inspection_available ?? true} />
            <Check name="isFeatured" label="Featured" defaultChecked={v.is_featured ?? false} />
          </div>
        </TabsPanel>

        <TabsPanel value="features" data-step="features">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {featureGroups.map((g) => (
              <div key={g.cat}>
                <h3 className="mb-2 text-sm font-semibold capitalize text-foreground">{g.cat}</h3>
                <div className="space-y-1.5">
                  {g.items.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm text-body">
                      <input type="checkbox" name="featureIds" value={f.id} defaultChecked={selectedFeatureIds.includes(f.id)} className="size-4 rounded border-border" />
                      {f.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsPanel>

        <TabsPanel value="images" data-step="images">
          <div className="space-y-6">
            <div>
              <L label="Vehicle Images"><span className="text-xs text-muted-foreground mb-2 block">Upload photos of the vehicle. Set one as the cover image.</span></L>
              <ImageUpload initialImages={initialImages} />
            </div>
            <hr className="border-border" />
            <div className="space-y-4">
              <L label="Description"><textarea name="description" defaultValue={v.description ?? ""} rows={5} className={inputCls} placeholder="Write a compelling description for this vehicle..." /></L>
              <L label="Dealer notes (internal)"><textarea name="dealerNotes" defaultValue={v.dealer_notes ?? ""} rows={2} className={inputCls} placeholder="Private notes, e.g. trade-in details or reconditioning costs..." /></L>
            </div>
          </div>
        </TabsPanel>
      </Tabs>

      {/* Status messages */}
      {state?.error ? <p className="rounded-lg bg-danger/5 border border-danger/30 px-4 py-2.5 text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="rounded-lg bg-success/5 border border-success/30 px-4 py-2.5 text-sm text-success">Saved successfully.</p> : null}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-3">
          {mode === "create" && !isFirst && (
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" /> Back
            </button>
          )}
          
          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDelete}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${confirmingDelete ? "border-danger bg-danger text-white hover:bg-danger/90 font-bold" : "border-danger/40 bg-card text-danger hover:bg-danger/10"}`}
            >
              <Trash2 className="size-4" />
              {confirmingDelete ? "Click to confirm delete" : "Delete Vehicle"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Step counter for create mode */}
          {mode === "create" && (
            <span className="text-xs text-muted-foreground">
              Step {currentIndex + 1} of {STEPS.length}
            </span>
          )}

          {/* Next button (all steps except last in create mode) */}
          {mode === "create" && !isLast && (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm"
            >
              Next <ChevronRight className="size-4" />
            </button>
          )}

          {/* Submit — only on last step in create mode, always in edit mode */}
          {(mode === "edit" || isLast) && (
            <button
              type="submit"
              disabled={pending || isCreatingInline}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60 transition-colors shadow-sm"
            >
              {pending ? (
                <><Loader2 className="size-4 animate-spin" /> Saving…</>
              ) : mode === "create" ? (
                <><CheckIcon className="size-4" /> Create vehicle</>
              ) : (
                "Save changes"
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function L({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold text-danger">{hint}</span> : null}
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-body">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 rounded border-border" />
      {label}
    </label>
  );
}
