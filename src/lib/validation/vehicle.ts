import { z } from "zod";

/** Vehicle admin validation — intentionally lenient so partial car data can be saved. */

export const fuelTypes = ["petrol", "diesel", "hybrid", "phev", "electric", "lpg"] as const;
export const transmissionTypes = ["automatic", "manual", "cvt", "dct"] as const;
export const bodyTypes = [
  "sedan", "hatch", "suv", "ute", "wagon", "coupe", "convertible", "van", "people_mover",
] as const;
export const driveTypes = ["fwd", "rwd", "awd", "four_wd"] as const;
export const vehicleStatuses = ["draft", "available", "reserved", "sold", "archived"] as const;

const currentYear = new Date().getFullYear();

/**
 * Coerce an empty string or 0 to undefined so optional numeric fields
 * don't fail min(1) when the field is left blank in the admin form.
 */
const optionalPositiveInt = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = Number(v);
      return isNaN(n) || n === 0 ? undefined : n;
    },
    z.number().int().positive().max(max).optional(),
  );

/**
 * Coerce empty string → undefined for optional enum fields so the
 * "not selected" state doesn't trip the enum validator.
 */
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(values).optional(),
  );

export const vehicleCreateSchema = z.object({
  stockId: z.string().trim().min(1).max(40),
  makeId: z.string().uuid(),
  modelId: z.string().uuid(),
  variant: z.string().trim().max(80).optional().or(z.literal("")),
  year: z.coerce.number().int().min(1900).max(currentYear + 2),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000),
  fuelType: z.enum(fuelTypes),
  transmission: z.enum(transmissionTypes),
  bodyType: z.enum(bodyTypes),
  driveType: optionalEnum(driveTypes),          // empty string → undefined, no enum crash
  engine: z.string().trim().max(120).optional().or(z.literal("")),
  powerKw: optionalPositiveInt(3000),            // blank / 0 → undefined, no min(1) crash
  seats: optionalPositiveInt(20),                // blank / 0 → undefined
  doors: optionalPositiveInt(10),                // blank / 0 → undefined
  exteriorColor: z.string().trim().max(60).optional().or(z.literal("")),
  interior: z.string().trim().max(120).optional().or(z.literal("")),
  vin: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || v.length === 0 || v.length === 17,
      { message: "VIN must be exactly 17 characters" },
    ),
  registration: z.string().trim().max(20).optional().or(z.literal("")),
  regoExpiry: z.string().date().optional().or(z.literal("")),
  price: z.coerce.number().positive().max(100_000_000),
  weeklyEstimate: z.coerce.number().nonnegative().optional(),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  safetyRating: z.string().trim().max(80).optional().or(z.literal("")),
  warrantyText: z.string().trim().max(500).optional().or(z.literal("")),
  roadworthyIncluded: z.boolean().optional().default(false),
  financeAvailable: z.boolean().optional().default(true),
  tradeInWelcome: z.boolean().optional().default(true),
  inspectionAvailable: z.boolean().optional().default(true),
  status: z.enum(vehicleStatuses).optional().default("draft"),
  isFeatured: z.boolean().optional().default(false),
  featuredOrder: z.coerce.number().int().optional(),
  locationId: z.string().uuid().optional().or(z.literal("")),
  dealerNotes: z.string().trim().max(3000).optional().or(z.literal("")),
  featureIds: z.array(z.string().uuid()).optional().default([]),
});

// Update: all fields optional (partial patch) plus id
export const vehicleUpdateSchema = vehicleCreateSchema.partial().extend({
  id: z.string().uuid(),
});

/**
 * One CSV import row — everything arrives as strings; makes/models
 * are matched by slug/name server-side.
 */
export const vehicleCsvRowSchema = z.object({
  stock_id: z.string().trim().min(1),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  variant: z.string().trim().optional(),
  year: z.coerce.number().int().min(1900).max(currentYear + 2),
  mileage_km: z.coerce.number().int().min(0),
  fuel_type: z.enum(fuelTypes),
  transmission: z.enum(transmissionTypes),
  body_type: z.enum(bodyTypes),
  drive_type: optionalEnum(driveTypes),
  price: z.coerce.number().positive(),
  exterior_color: z.string().trim().optional(),
  description: z.string().trim().optional(),
  engine: z.string().trim().optional(),
  power_kw: optionalPositiveInt(3000),
  seats: optionalPositiveInt(20),
  doors: optionalPositiveInt(10),
  interior: z.string().trim().optional(),
  vin: z.string().trim().optional(),
  registration: z.string().trim().optional(),
  rego_expiry: z.string().trim().optional().or(z.literal("")),
  safety_rating: z.string().trim().optional(),
  warranty_text: z.string().trim().optional(),
});

export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;
export type VehicleCsvRow = z.infer<typeof vehicleCsvRowSchema>;
