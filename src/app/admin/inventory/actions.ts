"use server";

import { revalidatePath } from "next/cache";
import { updateTags } from "@/lib/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePermission } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { vehicleCreateSchema, vehicleUpdateSchema, parseVehicleImages, vehicleStatuses } from "@/lib/validation/vehicle";

/* eslint-disable @typescript-eslint/no-explicit-any */

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Fire-and-forget activity log — never awaited on the critical path. */
function logActivityBg(userId: string, action: string, entityId: string, diff: Record<string, unknown> = {}) {
  const supabase = createAdminClient();
  // intentionally not awaited
  supabase.from("activity_logs")
    .insert({ user_id: userId, action, entity_type: "vehicle", entity_id: entityId, diff })
    .then(() => { /* no-op */ });
}

function revalidatePublic() {
  updateTags("vehicles");
  updateTags("public");
}

// Coerce empty-string optionals to null before DB insert.
function clean<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v;
  return out as T;
}

/**
 * Pre-sanitize raw FormData entries before Zod validation.
 * driveType: empty string → deleted (avoids enum crash)
 * powerKw / seats / doors: empty string or "0" → deleted (avoids min(1) crash)
 */
function sanitizeRaw(raw: Record<string, any>) {
  const out = { ...raw };
  if (!out.driveType || out.driveType === "") delete out.driveType;
  for (const field of ["powerKw", "seats", "doors", "weeklyEstimate", "featuredOrder"]) {
    const v = out[field];
    if (v === "" || v === "0" || v === 0 || v === null || v === undefined) delete out[field];
  }
  if (!out.locationId || out.locationId === "") delete out.locationId;
  return out;
}

/** Parallel slug build — fetches make + model slugs in one Promise.all. */
async function buildSlug(supabase: any, data: any): Promise<string> {
  const [{ data: mk }, { data: md }] = await Promise.all([
    supabase.from("makes").select("slug").eq("id", data.makeId).maybeSingle(),
    supabase.from("models").select("slug").eq("id", data.modelId).maybeSingle(),
  ]);
  return slugify(`${data.year}-${mk?.slug ?? "car"}-${md?.slug ?? ""}-${data.variant ?? ""}-${data.stockId}`);
}

/**
 * Safe MIME type detection — never throws on missing/invalid path.
 * Previously: `function mimeFor(path: string)` — would throw TypeError on undefined.
 */
function mimeFor(path: string | undefined | null): string {
  if (!path) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Batch-resolve media_asset IDs for a list of image paths.
 *
 * Strategy:
 * 1. Single SELECT for all paths at once (IN query) — O(1) round trips instead of O(N).
 * 2. For any paths not yet in media_assets, bulk-insert them in one INSERT.
 * 3. Return { idMap } on success, { idMap, error } on any DB failure.
 *    Callers must check .error and return early.
 */
async function resolveMediaIds(
  supabase: any,
  images: { path: string; url: string; isCover: boolean }[],
  uploadedBy: string,
): Promise<{ idMap: Map<string, string>; error?: string }> {
  if (images.length === 0) return { idMap: new Map() };

  // Filter out any images with empty/missing paths before touching the DB
  const validImages = images.filter((i) => i.path && i.path.trim() !== "");
  if (validImages.length === 0) return { idMap: new Map() };

  const paths = validImages.map((i) => i.path);

  // Single round trip: fetch all existing media_assets for these paths
  const { data: existing, error: selectError } = await supabase
    .from("media_assets")
    .select("id, storage_key")
    .in("storage_key", paths);

  if (selectError) {
    return { idMap: new Map(), error: `Failed to look up media assets: ${selectError.message}` };
  }

  const idMap = new Map<string, string>(
    (existing ?? []).map((r: any) => [r.storage_key, r.id]),
  );

  // Find which paths are new (not in DB yet)
  const newPaths = paths.filter((p) => !idMap.has(p));

  if (newPaths.length > 0) {
    // Single bulk INSERT for all new media_assets
    const { data: inserted, error: insertError } = await supabase
      .from("media_assets")
      .insert(newPaths.map((p) => ({ storage_key: p, mime: mimeFor(p), uploaded_by: uploadedBy })))
      .select("id, storage_key");

    if (insertError) {
      // Return the partial idMap so existing images still work, but signal the error
      return { idMap, error: `Failed to save media assets: ${insertError.message}` };
    }

    for (const r of inserted ?? []) {
      idMap.set(r.storage_key, r.id);
    }
  }

  return { idMap };
}

/**
 * Bulk-write vehicle_images rows in a single INSERT.
 * For updates: caller deletes existing rows first, then calls this.
 *
 * @returns undefined on success, or an error string that callers must surface.
 */
async function writeVehicleImages(
  supabase: any,
  vehicleId: string,
  images: { path: string; url: string; isCover: boolean }[],
  mediaIdMap: Map<string, string>,
): Promise<string | undefined> {
  if (images.length === 0) return undefined;

  const rows = images
    .map((img, i) => {
      if (!img.path) return null; // skip images with no storage path
      const mediaId = mediaIdMap.get(img.path);
      if (!mediaId) return null; // skip if media_asset lookup failed
      return { vehicle_id: vehicleId, media_id: mediaId, sort_order: i, is_cover: img.isCover };
    })
    .filter(Boolean);

  if (rows.length === 0) return undefined;

  const { error } = await supabase.from("vehicle_images").insert(rows);
  if (error) return `Failed to save vehicle images: ${error.message}`;

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createVehicle(_prev: unknown, formData: FormData) {
  try {
    const user = await requirePermission("inventory.write");
    const rawRaw = Object.fromEntries(formData.entries());
    const featureIds = formData.getAll("featureIds").map(String).filter(Boolean);
    const raw = sanitizeRaw(rawRaw);

    const parsed = vehicleCreateSchema.safeParse({
      ...raw,
      roadworthyIncluded:    rawRaw.roadworthyIncluded    === "on",
      financeAvailable:      rawRaw.financeAvailable       === "on",
      tradeInWelcome:        rawRaw.tradeInWelcome         === "on",
      inspectionAvailable:   rawRaw.inspectionAvailable    === "on",
      isFeatured:            rawRaw.isFeatured             === "on",
      featureIds,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }

    const d = parsed.data;
    const supabase = createAdminClient();

    // Parse + validate images early so media resolution can run in parallel with the slug build.
    const imagesInput = parseVehicleImages(formData.get("imageKeys"));
    if (!imagesInput.ok) return { error: imagesInput.error };
    const images = imagesInput.images ?? [];

    // ── Parallel: build slug + resolve media asset IDs ──────────────────────
    const [slug, mediaResult] = await Promise.all([
      buildSlug(supabase, d),
      resolveMediaIds(supabase, images, user.id),
    ]);

    if (mediaResult.error) return { error: mediaResult.error };

    const { featureIds: fids, ...cols } = d;
    const row = clean({
      stock_id: d.stockId, slug, make_id: d.makeId, model_id: d.modelId, variant: cols.variant,
      year: d.year, mileage_km: d.mileageKm, fuel_type: d.fuelType, transmission: d.transmission,
      body_type: d.bodyType, drive_type: cols.driveType ?? null, engine: cols.engine, power_kw: cols.powerKw ?? null,
      seats: cols.seats ?? null, doors: cols.doors ?? null, exterior_color: cols.exteriorColor, interior: cols.interior,
      vin: cols.vin, registration: cols.registration, rego_expiry: cols.regoExpiry, price: d.price,
      weekly_estimate: cols.weeklyEstimate ?? null, description: cols.description, safety_rating: cols.safetyRating,
      warranty_text: cols.warrantyText, roadworthy_included: d.roadworthyIncluded, finance_available: d.financeAvailable,
      trade_in_welcome: d.tradeInWelcome, inspection_available: d.inspectionAvailable, status: d.status,
      is_featured: d.isFeatured, featured_order: cols.featuredOrder ?? null, location_id: cols.locationId ?? null,
      dealer_notes: cols.dealerNotes,
      published_at: d.status !== "draft" ? new Date().toISOString() : null,
    });

    const { data: created, error: insertError } = await supabase.from("vehicles").insert(row).select("id").single();
    if (insertError) return { error: insertError.message };

    // ── Sequential: features then images (errors from each are surfaced) ─────
    if (fids.length > 0) {
      const { error: featuresError } = await supabase
        .from("vehicle_features")
        .insert(fids.map((fid) => ({ vehicle_id: created.id, feature_id: fid })));
      if (featuresError) return { error: `Failed to save vehicle features: ${featuresError.message}` };
    }

    const imageWriteError = await writeVehicleImages(supabase, created.id, images, mediaResult.idMap);
    if (imageWriteError) return { error: imageWriteError };

    // Fire-and-forget audit log — doesn't block the redirect
    logActivityBg(user.id, "vehicle.created", created.id, { stock_id: d.stockId });
    revalidatePublic();
    redirect(`/admin/inventory/${created.id}?created=1`);
  } catch (err) {
    // redirect() throws a special internal Next.js error — must re-throw it
    if (isRedirectError(err)) throw err;
    console.error("[createVehicle] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function updateVehicle(_prev: unknown, formData: FormData) {
  try {
    const user = await requirePermission("inventory.write");
    const rawRaw = Object.fromEntries(formData.entries());
    const featureIds = formData.getAll("featureIds").map(String).filter(Boolean);
    const raw = sanitizeRaw(rawRaw);

    const parsed = vehicleUpdateSchema.safeParse({
      ...raw,
      roadworthyIncluded:    rawRaw.roadworthyIncluded    === "on",
      financeAvailable:      rawRaw.financeAvailable       === "on",
      tradeInWelcome:        rawRaw.tradeInWelcome         === "on",
      inspectionAvailable:   rawRaw.inspectionAvailable    === "on",
      isFeatured:            rawRaw.isFeatured             === "on",
      featureIds,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    }

    const d = parsed.data;
    const supabase = createAdminClient();
    const { featureIds: fids, id, ...cols } = d;

    // Parse + validate images early. `null` = the Images tab was not submitted.
    const imagesInput = parseVehicleImages(formData.get("imageKeys"));
    if (!imagesInput.ok) return { error: imagesInput.error };
    const images = imagesInput.images ?? [];

    const row = clean({
      variant: cols.variant, year: cols.year, mileage_km: cols.mileageKm, fuel_type: cols.fuelType,
      transmission: cols.transmission, body_type: cols.bodyType, drive_type: cols.driveType,
      engine: cols.engine, power_kw: cols.powerKw, seats: cols.seats, doors: cols.doors,
      exterior_color: cols.exteriorColor, interior: cols.interior, vin: cols.vin, registration: cols.registration,
      rego_expiry: cols.regoExpiry, price: cols.price, weekly_estimate: cols.weeklyEstimate, description: cols.description,
      safety_rating: cols.safetyRating, warranty_text: cols.warrantyText, roadworthy_included: cols.roadworthyIncluded,
      finance_available: cols.financeAvailable, trade_in_welcome: cols.tradeInWelcome, inspection_available: cols.inspectionAvailable,
      status: cols.status, is_featured: cols.isFeatured, featured_order: cols.featuredOrder,
      location_id: cols.locationId, dealer_notes: cols.dealerNotes,
    });

    // ── Step 1: Update the vehicle row ───────────────────────────────────────
    const { error: updateError } = await supabase.from("vehicles").update(row).eq("id", id);
    if (updateError) return { error: `Failed to update vehicle: ${updateError.message}` };

    // ── Step 2: Resolve media asset IDs for submitted images ─────────────────
    const mediaResult = await resolveMediaIds(supabase, images, user.id);
    if (mediaResult.error) return { error: mediaResult.error };

    // ── Step 3: Replace vehicle features (only if featureIds was in form) ────
    if (fids !== undefined) {
      const { error: deleteFeaturesError } = await supabase
        .from("vehicle_features")
        .delete()
        .eq("vehicle_id", id);
      if (deleteFeaturesError) {
        return { error: `Failed to clear vehicle features: ${deleteFeaturesError.message}` };
      }

      if (fids.length > 0) {
        const { error: insertFeaturesError } = await supabase
          .from("vehicle_features")
          .insert(fids.map((fid) => ({ vehicle_id: id, feature_id: fid })));
        if (insertFeaturesError) {
          return { error: `Failed to save vehicle features: ${insertFeaturesError.message}` };
        }
      }
    }

    // ── Step 4: Replace vehicle images (only if imageKeys field was submitted) ─
    // images === null means the Images tab was NOT included in this
    // submission — preserve existing images. An empty array "[]" means the
    // user cleared all images, which is a valid intentional action.
    if (imagesInput.images !== null) {
      const { error: deleteImagesError } = await supabase
        .from("vehicle_images")
        .delete()
        .eq("vehicle_id", id);
      if (deleteImagesError) {
        return { error: `Failed to clear vehicle images: ${deleteImagesError.message}` };
      }

      const imageWriteError = await writeVehicleImages(supabase, id!, images, mediaResult.idMap);
      if (imageWriteError) return { error: imageWriteError };
    }

    // Fire-and-forget audit log
    logActivityBg(user.id, "vehicle.updated", id!);
    revalidatePublic();
    return { ok: true };
  } catch (err) {
    console.error("[updateVehicle] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function setVehicleStatus(id: string, status: string) {
  const user = await requirePermission("inventory.write");
  if (!(vehicleStatuses as readonly string[]).includes(status)) return { error: "Unknown status" };
  const supabase = createAdminClient();
  const { data: current, error: readError } = await supabase
    .from("vehicles")
    .select("status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!current) return { error: "Vehicle not found" };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  // sold_at drives the 60-day archive; a sale that falls through clears it.
  if (status === "sold") patch.sold_at = now;
  else if (current.status === "sold") patch.sold_at = null;
  // published_at is the first publication, not the last status change.
  if (status !== "draft" && !current.published_at) patch.published_at = now;

  const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
  if (error) return { error: error.message };
  logActivityBg(user.id, `vehicle.status.${status}`, id, { from: current.status, to: status });
  revalidatePublic();
  revalidatePath("/admin/inventory");
  return { ok: true };
}

export async function toggleFeatured(id: string, isFeatured: boolean) {
  await requirePermission("inventory.write");
  const supabase = createAdminClient();
  await supabase.from("vehicles").update({ is_featured: isFeatured }).eq("id", id);
  revalidatePublic();
  revalidatePath("/admin/inventory");
  return { ok: true };
}

export async function deleteVehicle(id: string, shouldRedirect: boolean = true) {
  const user = await requirePermission("inventory.delete");
  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };
  logActivityBg(user.id, "vehicle.deleted", id);
  revalidatePublic();
  revalidatePath("/admin/inventory");
  if (shouldRedirect) {
    redirect("/admin/inventory");
  } else {
    return { ok: true };
  }
}
