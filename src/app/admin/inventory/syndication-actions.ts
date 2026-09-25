"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultDealerId, getSyndicationVehicle } from "@/lib/data/syndication";
import { evaluateReadiness } from "@/lib/syndication/readiness";
import { syndicationExtraSchema } from "@/lib/validation/syndication";
import type { ReadinessResult } from "@/lib/syndication/readiness";

/* eslint-disable @typescript-eslint/no-explicit-any --
   Untyped Supabase client, matching src/app/admin/inventory/actions.ts. */

/**
 * Server actions for the syndication sidecar (migration 0014).
 *
 * Kept in their own file rather than bolted onto `actions.ts` so the website's
 * own vehicle save path stays untouched — a syndication bug must never be able
 * to break the dealer's ability to edit a car. `updateVehicle` continues to own
 * `public.vehicles`; this file only ever writes
 * `public.syndication_vehicle_extra`.
 */

type ActionResult = { ok: true; readiness: ReadinessResult } | { error: string };


/** Coerce empty-string optionals to null before the DB write. */
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v;
  return out as T;
}

/**
 * Creates or updates a vehicle's syndication sidecar row.
 *
 * Concurrency (failure-modes.md F13): when the form supplies the `version` it
 * was rendered with, the update is conditional on that version still being
 * current. A mismatch means another staff member saved in the meantime, and we
 * surface a conflict rather than last-write-win — silently discarding a
 * colleague's compliance edit is exactly the failure this guards.
 */
export async function saveSyndicationExtra(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("syndication.manage");

  const raw = Object.fromEntries(formData.entries());
  const parsed = syndicationExtraSchema.safeParse({
    ...raw,
    wovrFlag: raw.wovrFlag === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const d = parsed.data;
  const supabase = createAdminClient();

  const dealerId = await getDefaultDealerId();
  if (!dealerId) {
    return { error: "No default syndication dealer is configured. Run migration 0014." };
  }

  const row = clean({
    vehicle_id: d.vehicleId,
    dealer_id: dealerId,
    rego_state: d.regoState ?? null,
    build_date: d.buildDate ?? null,
    compliance_date: d.complianceDate ?? null,
    wovr_flag: d.wovrFlag ?? false,
    condition: d.condition ?? "used",
    // Never defaulted — an unset price type must stay unset so the readiness
    // gate keeps blocking publish (failure-modes.md F8).
    price_type: d.priceType ?? null,
    badge: d.badge ?? null,
    engine_cc: d.engineCc ?? null,
  });

  // Optimistic lock: only enforced when the row already exists AND the client
  // told us which version it was editing.
  if (d.version != null) {
    const { data: existing } = await supabase
      .from("syndication_vehicle_extra")
      .select("version")
      .eq("vehicle_id", d.vehicleId)
      .maybeSingle();

    if (existing && Number((existing as any).version) !== d.version) {
      return {
        error:
          "Someone else saved this vehicle's compliance details while you were editing. " +
          "Reload the page to see their changes before saving again.",
      };
    }
  }

  const { error } = await supabase
    .from("syndication_vehicle_extra")
    .upsert(row, { onConflict: "vehicle_id" });

  if (error) return { error: error.message };

  // Fire-and-forget audit log, matching the pattern in actions.ts.
  supabase
    .from("activity_logs")
    .insert({
      user_id: user.id,
      action: "vehicle.syndication_updated",
      entity_type: "vehicle",
      entity_id: d.vehicleId,
      diff: {},
    })
    .then(() => { /* no-op */ });

  updateTags("vehicles");
  revalidatePath("/admin/inventory");
  revalidatePath(`/admin/inventory/${d.vehicleId}`);

  // Return the freshly-computed readiness so the editor can show the staff
  // member the effect of what they just saved without a round-trip.
  const vehicle = await getSyndicationVehicle(d.vehicleId);
  const readiness: ReadinessResult = vehicle
    ? evaluateReadiness(vehicle)
    : { ready: false, rejections: [], warnings: [] };

  return { ok: true, readiness };
}

/**
 * Approves the AI-drafted description for a vehicle.
 *
 * Hard Rule 4 / failure-modes.md F5: generated copy is a draft until a named
 * human approves it. The approver is recorded, because "who signed off on this
 * advertising claim" is the question that matters if a description turns out to
 * be wrong.
 */
export async function approveGeneratedDescription(vehicleId: string): Promise<ActionResult> {
  const user = await requirePermission("syndication.manage");
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("syndication_vehicle_extra")
    .select("description_generated")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  if (!existing || !(existing as any).description_generated) {
    return { error: "There is no generated description to approve for this vehicle." };
  }

  const { error } = await supabase
    .from("syndication_vehicle_extra")
    .update({ description_approved_at: new Date().toISOString(), description_approved_by: user.id })
    .eq("vehicle_id", vehicleId);

  if (error) return { error: error.message };

  supabase
    .from("activity_logs")
    .insert({
      user_id: user.id,
      action: "vehicle.description_approved",
      entity_type: "vehicle",
      entity_id: vehicleId,
      diff: {},
    })
    .then(() => { /* no-op */ });

  revalidatePath(`/admin/inventory/${vehicleId}`);

  const vehicle = await getSyndicationVehicle(vehicleId);
  return {
    ok: true,
    readiness: vehicle ? evaluateReadiness(vehicle) : { ready: false, rejections: [], warnings: [] },
  };
}
