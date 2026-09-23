import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";
import { stringify } from "csv-stringify/sync";
import { GoogleVehicleAdsAdapter, GOOGLE_VEHICLE_ADS_HEADERS } from "./adapters/google-vehicle-ads";
import { MetaMarketplaceAdapter, META_MARKETPLACE_HEADERS } from "./adapters/meta-marketplace";
import { ClassifiedsAdapter, CLASSIFIEDS_FEED_HEADERS } from "./adapters/classifieds-feed";
import { WhatsAppCatalogAdapter, WHATSAPP_CATALOG_HEADERS } from "./adapters/whatsapp-catalog";
import type { CanonicalVehicle } from "./types";
import { evaluateVolumeGuard } from "./volume-guard";
import { buildEnumMap } from "./enum-map";
import { site } from "@/config/site";

export async function runSync(
  dealerId: string, 
  channelCode: string, 
  trigger: 'scheduled' | 'manual' | 'sold_fastlane',
  force: boolean = false
) {
  const supabase = createAdminClient();
  const isLivePush = process.env.SYNDICATION_LIVE_PUSH === "true" && process.env.NODE_ENV === "production";
  const dryRun = !isLivePush;

  // 1. Single-flight lock
  const { data: running } = await supabase
    .from("sync_run")
    .select("id")
    .eq("dealer_id", dealerId)
    .eq("channel_code", channelCode)
    .eq("status", "running")
    .gt("started_at", new Date(Date.now() - 5 * 60000).toISOString())
    .limit(1);

  if (running && running.length > 0) {
    return { success: false, reason: "A sync is already running for this channel." };
  }

  const { data: syncRun, error: insertErr } = await supabase
    .from("sync_run")
    .insert({
      dealer_id: dealerId,
      channel_code: channelCode,
      trigger,
      status: "running",
      dry_run: dryRun,
    })
    .select("id")
    .single();

  if (insertErr || !syncRun) {
    throw new Error(`Failed to create sync_run: ${insertErr?.message}`);
  }

  const runId = syncRun.id;

  try {
    // 2. Fetch Channel Connection
    const { data: connection } = await supabase
      .from("channel_connection")
      .select("*")
      .eq("dealer_id", dealerId)
      .eq("channel_code", channelCode)
      .single();

    if (!connection) {
      throw new Error("No channel connection found.");
    }

    // Fetch enum mappings
    const { data: enumRows } = await supabase
      .from("channel_enum_map")
      .select("canonical_field, canonical_value, channel_value")
      .eq("channel_code", channelCode);
      
    const enumMap = buildEnumMap((enumRows || []).map(r => ({
      canonicalField: r.canonical_field,
      canonicalValue: r.canonical_value,
      channelValue: r.channel_value
    })));

    // 3. Fetch Vehicles
    const { data: rawVehicles, error: vErr } = await supabase
      .from("syndication_vehicle_projection")
      .select("*")
      .eq("dealer_id", dealerId);

    if (vErr) throw vErr;

    const vehicles: CanonicalVehicle[] = (rawVehicles || []).map(v => ({
      vehicleId: v.vehicle_id,
      dealerId: v.dealer_id,
      locationId: v.location_id,
      stockNumber: v.stock_number,
      vin: v.vin,
      rego: v.rego,
      regoState: v.rego_state as CanonicalVehicle["regoState"],
      make: v.make,
      model: v.model,
      // Present once migration 0020 is applied (select("*") picks them up); null before.
      makeSlug: v.make_slug ?? null,
      modelSlug: v.model_slug ?? null,
      vehicleSlug: v.vehicle_slug ?? null,
      variant: v.variant,
      badge: v.badge,
      bodyType: v.body_type as CanonicalVehicle["bodyType"],
      year: v.year,
      odometerKm: v.odometer_km,
      transmission: v.transmission as CanonicalVehicle["transmission"],
      fuelType: v.fuel_type as CanonicalVehicle["fuelType"],
      drivetrain: v.drivetrain as CanonicalVehicle["drivetrain"],
      doors: v.doors,
      seats: v.seats,
      engineCc: v.engine_cc,
      engineText: v.engine_text,
      colourExterior: v.colour_exterior,
      colourInterior: v.colour_interior,
      condition: v.condition as CanonicalVehicle["condition"],
      priceAmount: v.price_amount,
      priceType: v.price_type as CanonicalVehicle["priceType"],
      currency: v.currency as CanonicalVehicle["currency"],
      status: v.status as CanonicalVehicle["status"],
      descriptionRaw: v.description_raw,
      descriptionGenerated: v.description_generated,
      descriptionApprovedAt: v.description_approved_at,
      buildDate: v.build_date,
      complianceDate: v.compliance_date,
      wovrFlag: v.wovr_flag,
      tiktokUrl: v.tiktok_url,
      tiktokEmbedHtml: v.tiktok_embed_html,
      imageCount: v.image_count,
      updatedAt: v.updated_at,
      soldAt: v.sold_at,
      version: v.version,
    }));

    // Find duplicates for readiness check
    const vinCounts = new Map<string, number>();
    for (const v of vehicles) {
      if (v.vin) vinCounts.set(v.vin, (vinCounts.get(v.vin) || 0) + 1);
    }
    const vinDuplicates = new Set(
      Array.from(vinCounts.entries()).filter(([, count]) => count > 1).map(([vin]) => vin)
    );

    let adapter = GoogleVehicleAdsAdapter;
    if (channelCode === "meta_marketplace") adapter = MetaMarketplaceAdapter;
    else if (channelCode === "whatsapp_catalog") adapter = WhatsAppCatalogAdapter;
    else if (channelCode === "gumtree" || channelCode === "carsales") adapter = ClassifiedsAdapter;

    let okCount = 0;
    let rejectedCount = 0;
    let skippedCount = 0;
    const csvRows: Record<string, string>[] = [];

    // F4/Sprint 4: Google explicitly recommends shipping a 5-vehicle feed first.
    const googleLimit = process.env.GOOGLE_FEED_LIMIT ? parseInt(process.env.GOOGLE_FEED_LIMIT, 10) : 5;
    const limit = channelCode === "google_vehicle_ads" ? googleLimit : Infinity;
    const vehiclesToProcess = vehicles.slice(0, limit);

    // Fetch images for vehiclesToProcess
    if (vehiclesToProcess.length > 0) {
      const vehicleIds = vehiclesToProcess.map(v => v.vehicleId);
      const { data: images } = await supabase
        .from("vehicle_images")
        .select("vehicle_id, sort_order, is_cover, media_assets:media_id ( storage_key )")
        .in("vehicle_id", vehicleIds);
        
      if (images && images.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
        const imageMap = new Map<string, { url: string; isCover: boolean; sortOrder: number }[]>();
        
        for (const img of images) {
          const media = Array.isArray(img.media_assets) ? img.media_assets[0] : img.media_assets;
          if (media && media.storage_key) {
            const url = `${supabaseUrl}/storage/v1/object/public/media/${media.storage_key}`;
            const arr = imageMap.get(img.vehicle_id) || [];
            arr.push({ url, isCover: !!img.is_cover, sortOrder: img.sort_order || 0 });
            imageMap.set(img.vehicle_id, arr);
          }
        }
        
        for (const v of vehiclesToProcess) {
          const vImages = imageMap.get(v.vehicleId) || [];
          vImages.sort((a, b) => {
            if (a.isCover && !b.isCover) return -1;
            if (!a.isCover && b.isCover) return 1;
            return a.sortOrder - b.sortOrder;
          });
          v.images = vImages.map(i => ({ url: i.url }));
        }
      }
    }

    // 4. Transform and Upsert listings
    for (const v of vehiclesToProcess) {
      if (v.status !== 'available') {
        skippedCount++;
        // Make sure it is marked disabled/removed in channel_listing
        await supabase
          .from("channel_listing")
          .upsert({ vehicle_id: v.vehicleId, channel_code: channelCode, state: 'removed' }, { onConflict: 'vehicle_id,channel_code' });
        continue;
      }

      const res = adapter.transform(v, { vinDuplicates, storeCode: connection.external_account_id || site.brandName.toUpperCase(), enumMap });
      
      if (res.type === "rejected") {
        rejectedCount++;
        const primaryRejection = res.rejections[0];
        await supabase
          .from("channel_listing")
          .upsert({
            vehicle_id: v.vehicleId,
            channel_code: channelCode,
            state: 'rejected',
            rejection_code: primaryRejection.code,
            rejection_message: primaryRejection.message,
            rejection_fix_hint: primaryRejection.fixHint,
            rejection_at: new Date().toISOString()
          }, { onConflict: 'vehicle_id,channel_code' });
      } else {
        okCount++;
        // Sort keys to ensure stable hash
        const sortedKeys = Object.keys(res.payload).sort();
        const stablePayload = sortedKeys.map(k => res.payload[k]);
        const hash = createHash('sha256').update(JSON.stringify(stablePayload)).digest('hex');
        
        csvRows.push(res.payload);

        await supabase
          .from("channel_listing")
          .upsert({
            vehicle_id: v.vehicleId,
            channel_code: channelCode,
            state: 'queued', // Will become 'live' once pushed
            payload_hash: hash,
            rejection_code: null,
            rejection_message: null,
            rejection_fix_hint: null,
            rejection_at: null
          }, { onConflict: 'vehicle_id,channel_code' });
      }
    }

    // 5. Volume Guard
    // Fetch last success count
    const { data: lastRun } = await supabase
      .from("sync_run")
      .select("item_count")
      .eq("dealer_id", dealerId)
      .eq("channel_code", channelCode)
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    const previousCount = lastRun ? lastRun.item_count : 0;
    const guardRes = evaluateVolumeGuard({
      currentItemCount: okCount,
      previousItemCount: previousCount,
      force: force,
      forcedBy: force ? "System Admin" : null
    });

    if (!guardRes.publish) {
      await supabase.from("sync_run").update({
        status: "aborted",
        item_count: okCount,
        ok_count: okCount,
        rejected_count: rejectedCount,
        skipped_count: skippedCount,
        previous_item_count: previousCount,
        volume_guard_tripped: true,
        volume_guard_reason: guardRes.reason,
        finished_at: new Date().toISOString()
      }).eq("id", runId);
      
      return { success: false, reason: `Volume guard tripped: ${guardRes.reason}` };
    }

    // 6. Generate and Store Feed (Atomic)
    let headers: string[] = [...GOOGLE_VEHICLE_ADS_HEADERS];
    if (channelCode === "meta_marketplace") headers = [...META_MARKETPLACE_HEADERS];
    else if (channelCode === "whatsapp_catalog") headers = [...WHATSAPP_CATALOG_HEADERS];
    else if (channelCode === "gumtree" || channelCode === "carsales") headers = [...CLASSIFIEDS_FEED_HEADERS];

    const feedContent = stringify(csvRows, {
      header: true,
      columns: headers,
    });

    const bucketName = process.env.FEED_STORAGE_BUCKET || "syndication-feeds";
    const tempKey = `${dealerId}/${channelCode}_temp.csv`;
    const finalKey = `${dealerId}/${channelCode}.csv`;

    const { error: uploadErr } = await supabase.storage.from(bucketName).upload(tempKey, feedContent, {
      contentType: "text/csv",
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    // Pointer swap
    await supabase.storage.from(bucketName).move(tempKey, finalKey);

    // Update listings to 'live'
    await supabase.from("channel_listing")
      .update({ state: 'live', last_pushed_at: new Date().toISOString() })
      .eq("channel_code", channelCode)
      .eq("state", "queued");

    // 7. Mark Success
    await supabase.from("sync_run").update({
      status: "success",
      item_count: okCount,
      ok_count: okCount,
      rejected_count: rejectedCount,
      skipped_count: skippedCount,
      previous_item_count: previousCount,
      feed_storage_key: finalKey,
      finished_at: new Date().toISOString()
    }).eq("id", runId);

    return { success: true, count: okCount };
  } catch (error) {
    const err = error as Error;
    await supabase.from("sync_run").update({
      status: "failed",
      error_summary: err.message,
      finished_at: new Date().toISOString()
    }).eq("id", runId);
    
    return { success: false, reason: err.message };
  }
}
