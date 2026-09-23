import type { BodyType, DriveType, FuelType, TransmissionType, VehicleStatus } from "@/lib/domain";

/**
 * Canonical syndication types.
 *
 * `CanonicalVehicle` mirrors `public.syndication_vehicle_projection` (migration
 * 0014) one-for-one. Adapters consume ONLY this shape — never a legacy table
 * row — so the website team can restructure its schema and syndication breaks
 * at the single projection seam rather than inside every adapter
 * (docs/syndication/architecture.md §2).
 *
 * Field names are camelCase at this boundary even though the view's columns are
 * snake_case, matching the convention in `src/lib/domain.ts`.
 */

export type SyndicationCondition = "used" | "cpo" | "demo";
export type SyndicationPriceType = "drive_away" | "ex_gov";
export type AuState = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";

export type CanonicalVehicle = {
  vehicleId: string;
  dealerId: string | null;
  locationId: string | null;
  stockNumber: string;

  vin: string | null;
  rego: string | null;
  regoState: AuState | null;

  make: string;
  model: string;
  /** URL slugs from the projection (migration 0020); null until applied — see listing-url.ts. */
  makeSlug: string | null;
  modelSlug: string | null;
  vehicleSlug: string | null;
  variant: string | null;
  badge: string | null;
  bodyType: BodyType;
  year: number;

  /** ALWAYS integer kilometres. Adapters convert to miles at their own edge (F7). */
  odometerKm: number;
  transmission: TransmissionType;
  fuelType: FuelType;
  drivetrain: DriveType | null;
  doors: number | null;
  seats: number | null;
  engineCc: number | null;
  engineText: string | null;
  colourExterior: string | null;
  colourInterior: string | null;

  condition: SyndicationCondition;
  priceAmount: number;
  priceType: SyndicationPriceType | null;
  currency: "AUD";

  status: VehicleStatus;
  descriptionRaw: string | null;
  descriptionGenerated: string | null;
  /** NULL means generated copy has never been approved and must not publish. */
  descriptionApprovedAt: string | null;

  buildDate: string | null;
  complianceDate: string | null;
  wovrFlag: boolean;

  tiktokUrl: string | null;
  tiktokEmbedHtml: string | null;

  imageCount: number;
  images?: { url: string }[];

  updatedAt: string;
  soldAt: string | null;
  version: number;
};

/**
 * A blocking reason a vehicle cannot be published.
 *
 * `message` is shown to staff verbatim, so it must read as plain English with
 * no jargon or codes. `fixHint` tells them exactly where to go — the difference
 * between a dealer fixing a listing themselves and raising a support ticket
 * (failure-modes.md F19).
 */
export type Rejection = {
  code: string;
  field: string;
  message: string;
  fixHint: string;
};

/** A non-blocking issue: the listing publishes, but degraded. */
export type Warning = {
  code: string;
  field: string;
  message: string;
};

export type TransformResult<TPayload> =
  | { ok: true; payload: TPayload; warnings: Warning[] }
  | { ok: false; rejections: Rejection[] };
