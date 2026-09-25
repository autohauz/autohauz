import type { BodyType, FuelType, TransmissionType } from "@/lib/domain";

/** Shared display labels + navigation taxonomy for the used-car site. */

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  suv: "SUV",
  ute: "Ute / Pickup",
  hatch: "Hatchback",
  sedan: "Sedan",
  wagon: "Wagon",
  coupe: "Coupe",
  convertible: "Convertible",
  van: "Van",
  people_mover: "People Mover",
};

export const FUEL_LABELS: Record<FuelType, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  phev: "Plug-in Hybrid",
  electric: "Electric",
  lpg: "LPG",
};

export const TRANSMISSION_LABELS: Record<TransmissionType, string> = {
  automatic: "Automatic",
  manual: "Manual",
  cvt: "CVT",
  dct: "Dual Clutch",
};

export const DRIVE_LABELS: Record<string, string> = {
  fwd: "Front-Wheel Drive",
  rwd: "Rear-Wheel Drive",
  awd: "All-Wheel Drive",
  four_wd: "4x4",
};

/** Body types surfaced in nav/mega-menu, in display order. */
export const NAV_BODY_TYPES: BodyType[] = [
  "suv", "ute", "hatch", "sedan", "wagon", "van", "people_mover",
];

/** Budget landing bands → /used-cars/under-{price}. */
export const BUDGET_BANDS: { max: number; label: string }[] = [
  { max: 15000, label: "Under $15,000" },
  { max: 20000, label: "Under $20,000" },
  { max: 30000, label: "Under $30,000" },
  { max: 40000, label: "Under $40,000" },
  { max: 50000, label: "Under $50,000" },
];

export const bodyTypeHref = (b: BodyType) => `/used-cars/body/${b.replace("_", "-")}`;
export const budgetHref = (max: number) => `/used-cars/under-${max}`;
export const makeHref = (slug: string) => `/used-cars/${slug}`;
export const modelHref = (makeSlug: string, modelSlug: string) => `/used-cars/${makeSlug}/${modelSlug}`;
export const vehicleHref = (makeSlug: string, modelSlug: string, slug: string) => `/used-cars/${makeSlug}/${modelSlug}/${slug}`;

/** Parse a `body-type` URL segment (kebab) back to a BodyType enum value. */
export function parseBodySegment(seg: string): BodyType | null {
  const v = seg.replace("-", "_");
  return (Object.keys(BODY_TYPE_LABELS) as BodyType[]).includes(v as BodyType) ? (v as BodyType) : null;
}

/** Format a price as AUD with no decimals. */
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

/** Format kilometres with thousands separators. */
export function formatKm(n: number): string {
  return `${new Intl.NumberFormat("en-AU").format(n)} km`;
}
