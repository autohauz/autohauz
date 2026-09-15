import type { BodyType, DriveType, FuelType, TransmissionType, VehicleFilters, VehicleSort } from "@/lib/domain";
import { bodyTypes, fuelTypes, transmissionTypes, driveTypes } from "@/lib/validation/vehicle";

type SP = Record<string, string | string[] | undefined>;

const SORTS: VehicleSort[] = ["recommended", "price_asc", "price_desc", "year_desc", "km_asc", "newest"];

function str(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function num(sp: SP, key: string): number | undefined {
  const v = str(sp, key);
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function oneOf<T extends string>(sp: SP, key: string, allowed: readonly T[]): T | undefined {
  const v = str(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Parse a listing/landing page's URL query into typed filters + sort + page. */
export function parseVehicleSearchParams(sp: SP): {
  filters: VehicleFilters;
  sort: VehicleSort;
  page: number;
} {
  const filters: VehicleFilters = {
    make: str(sp, "make"),
    model: str(sp, "model"),
    bodyType: oneOf<BodyType>(sp, "body", bodyTypes),
    fuelType: oneOf<FuelType>(sp, "fuel", fuelTypes),
    transmission: oneOf<TransmissionType>(sp, "transmission", transmissionTypes),
    driveType: oneOf<DriveType>(sp, "drive", driveTypes),
    seats: num(sp, "seats"),
    priceMin: num(sp, "price_min"),
    priceMax: num(sp, "price_max"),
    yearMin: num(sp, "year_min"),
    yearMax: num(sp, "year_max"),
    kmMax: num(sp, "km_max"),
    city: str(sp, "city"),
    q: str(sp, "q"),
    status: oneOf<"all" | "available" | "sold">(sp, "status", ["all", "available", "sold"]) ?? "available",
  };

  const sort = oneOf<VehicleSort>(sp, "sort", SORTS) ?? "recommended";
  const page = Math.max(1, num(sp, "page") ?? 1);
  return { filters, sort, page };
}
