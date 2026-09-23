/* eslint-disable @typescript-eslint/no-explicit-any --
   The Supabase client is deliberately untyped (no generated Database types), so
   projection rows surface as `any` at this boundary. Rows are shaped into the
   CanonicalVehicle domain type before leaving this module — matching the
   convention in src/lib/data/inventory.ts. */
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateReadiness, findDuplicateVins } from "@/lib/syndication/readiness";
import type { CanonicalVehicle } from "@/lib/syndication/types";

/**
 * Read-side data access for syndication.
 *
 * Every read here goes through `syndication_vehicle_projection` (migration
 * 0014) — never a legacy table. That is the seam described in
 * architecture.md §2: the website team can restructure `vehicles` and this one
 * module breaks, not six adapters.
 *
 * All callers are admin-only. `createAdminClient()` bypasses RLS, so callers
 * must have passed `requireAdmin()` first.
 */

/** Statuses a vehicle must be in to be a syndication candidate. */
const SYNDICATION_CANDIDATE_STATUSES = ["available", "reserved"] as const;

const PROJECTION_SELECT = `
  vehicle_id, dealer_id, location_id, stock_number,
  vin, rego, rego_state,
  make, model, variant, badge, body_type, year,
  odometer_km, transmission, fuel_type, drivetrain, doors, seats,
  engine_cc, engine_text, colour_exterior, colour_interior,
  condition, price_amount, price_type, currency,
  status, description_raw, description_generated, description_approved_at,
  build_date, compliance_date, wovr_flag,
  image_count, updated_at, sold_at, version
`;

function toCanonical(row: any): CanonicalVehicle {
  return {
    vehicleId: row.vehicle_id,
    dealerId: row.dealer_id ?? null,
    locationId: row.location_id ?? null,
    stockNumber: row.stock_number,

    vin: row.vin ?? null,
    rego: row.rego ?? null,
    regoState: row.rego_state ?? null,

    make: row.make,
    model: row.model,
    makeSlug: row.make_slug ?? null,
    modelSlug: row.model_slug ?? null,
    vehicleSlug: row.vehicle_slug ?? null,
    variant: row.variant ?? null,
    badge: row.badge ?? null,
    bodyType: row.body_type,
    year: Number(row.year),

    odometerKm: Number(row.odometer_km),
    transmission: row.transmission,
    fuelType: row.fuel_type,
    drivetrain: row.drivetrain ?? null,
    doors: row.doors == null ? null : Number(row.doors),
    seats: row.seats == null ? null : Number(row.seats),
    engineCc: row.engine_cc == null ? null : Number(row.engine_cc),
    engineText: row.engine_text ?? null,
    colourExterior: row.colour_exterior ?? null,
    colourInterior: row.colour_interior ?? null,

    condition: row.condition,
    priceAmount: Number(row.price_amount),
    priceType: row.price_type ?? null,
    currency: "AUD",

    status: row.status,
    descriptionRaw: row.description_raw ?? null,
    descriptionGenerated: row.description_generated ?? null,
    descriptionApprovedAt: row.description_approved_at ?? null,

    buildDate: row.build_date ?? null,
    complianceDate: row.compliance_date ?? null,
    wovrFlag: Boolean(row.wovr_flag),

    tiktokUrl: row.tiktok_url ?? null,
    tiktokEmbedHtml: row.tiktok_embed_html ?? null,

    imageCount: Number(row.image_count ?? 0),

    updatedAt: row.updated_at,
    soldAt: row.sold_at ?? null,
    version: Number(row.version ?? 1),
  };
}

/** Every vehicle currently eligible to be syndicated, in canonical shape. */
export async function getSyndicationCandidates(): Promise<CanonicalVehicle[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("syndication_vehicle_projection")
    .select(PROJECTION_SELECT)
    .in("status", SYNDICATION_CANDIDATE_STATUSES);

  // Throw rather than returning [] on a real DB error: an empty candidate set
  // is indistinguishable from "the dealer has no stock", and a feed rendered
  // from an errored query is exactly how a truncated feed wipes a dealer's
  // listings (failure-modes.md F1).
  if (error) throw new Error(`syndication projection query failed: ${error.message}`);

  return (data ?? []).map(toCanonical);
}

/** One vehicle in canonical shape, or null. Used by the editor's validator. */
export async function getSyndicationVehicle(vehicleId: string): Promise<CanonicalVehicle | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("syndication_vehicle_projection")
    .select(PROJECTION_SELECT)
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  if (error) throw new Error(`syndication projection query failed: ${error.message}`);
  return data ? toCanonical(data) : null;
}

export type BackfillCounts = {
  /** Vehicles eligible for syndication right now. */
  candidates: number;
  missingVin: number;
  invalidVin: number;
  missingPriceType: number;
  missingImages: number;
  /** WOVR-flagged vehicles whose description does not disclose it. */
  wovrUndisclosed: number;
  /** Vehicles clearing every base gate. */
  ready: number;
};

/**
 * Backfill dashboard counters.
 *
 * This is the number Sprint 1 exists to move: `missingVin` was 38 of 38 active
 * vehicles at the Task 0 audit, which is why no adapter could be built. Staff
 * work this queue to zero.
 */
export async function getBackfillCounts(): Promise<BackfillCounts> {
  const candidates = await getSyndicationCandidates();
  const duplicates = findDuplicateVins(candidates);

  const counts: BackfillCounts = {
    candidates: candidates.length,
    missingVin: 0,
    invalidVin: 0,
    missingPriceType: 0,
    missingImages: 0,
    wovrUndisclosed: 0,
    ready: 0,
  };

  for (const v of candidates) {
    const { ready, rejections } = evaluateReadiness(v, { vinDuplicates: duplicates });
    if (ready) counts.ready += 1;
    for (const r of rejections) {
      if (r.code === "MISSING_VIN") counts.missingVin += 1;
      else if (r.code === "INVALID_VIN" || r.code === "DUPLICATE_VIN") counts.invalidVin += 1;
      else if (r.code === "MISSING_PRICE_TYPE") counts.missingPriceType += 1;
      else if (r.code === "MEDIA_NOT_READY") counts.missingImages += 1;
      else if (r.code === "WOVR_NOT_DISCLOSED") counts.wovrUndisclosed += 1;
    }
  }

  return counts;
}

/** The single default dealer row. Resolved by flag, never a hardcoded uuid. */
export async function getDefaultDealerId(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("syndication_dealer")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  return (data as any)?.id ?? null;
}
