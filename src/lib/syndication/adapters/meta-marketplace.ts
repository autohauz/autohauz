import type { CanonicalVehicle } from "../types";
import type { ChannelAdapter, TransformResult } from "./types";
import { evaluateReadiness } from "../readiness";
import { mapEnum, type EnumMap } from "../enum-map";
import { listingUrl } from "@/lib/syndication/listing-url";

/**
 * Frozen headers for Meta Automotive Inventory.
 * Exact headers mapping to Meta's Catalog requirements.
 */
export const META_MARKETPLACE_HEADERS = [
  "id",
  "title",
  "description",
  "url",
  "image_url",
  "additional_image_urls",
  "price",
  "state_of_vehicle",
  "mileage.value",
  "mileage.unit",
  "vin",
  "make",
  "model",
  "year",
  "body_style",
  "transmission",
  "exterior_color"
] as const;

export const MetaMarketplaceAdapter: ChannelAdapter = {
  code: "meta_marketplace",
  name: "Meta Marketplace",

  transform(v: CanonicalVehicle, opts: { vinDuplicates?: ReadonlySet<string>; storeCode?: string; enumMap: EnumMap }): TransformResult {
    // 1. Evaluate base channel-agnostic readiness
    const baseReadiness = evaluateReadiness(v, { vinDuplicates: opts.vinDuplicates });
    const rejections = [...baseReadiness.rejections];
    const warnings = [...baseReadiness.warnings];

    // 2. Meta-specific validations
    // Note: CanonicalVehicle does not have 'new' in its type definition, so condition is safe,
    // but we add this safeguard conceptually.
    if ((v.condition as string) === "new") {
      rejections.push({
        code: "CONDITION_NOT_SUPPORTED",
        field: "condition",
        message: "Meta Marketplace only supports used and certified pre-owned vehicles. New vehicles are rejected.",
        fixHint: "This vehicle cannot be published to Meta.",
      });
    }

    // F7: Mileage must exceed 500 miles (805 km) unless rego plate present.
    // 805 km = ~500 miles.
    if (v.odometerKm < 805 && !v.rego) {
      rejections.push({
        code: "ODOMETER_TOO_LOW",
        field: "odometerKm",
        message: `Mileage (${v.odometerKm} km) is below Meta's 500-mile (805 km) minimum for unregistered vehicles.`,
        fixHint: "Add the registration plate to exempt this vehicle from the minimum mileage requirement.",
      });
    }

    if (v.bodyType) {
      const mappedBody = mapEnum(opts.enumMap, "body_type", v.bodyType);
      if (!mappedBody.ok) {
        rejections.push({
          code: "UNMAPPED_ENUM",
          field: "bodyType",
          message: `Body type "${v.bodyType}" is not mapped for Meta.`,
          fixHint: "Update the channel mapping for this body type.",
        });
      }
    }

    if (rejections.length > 0) {
      return { type: "rejected", rejections, warnings };
    }

    // 3. Construct payload (Pure: no I/O)
    const priceStr = `${v.priceAmount} ${v.currency}`;

    let description = v.descriptionRaw ?? "";
    if (v.descriptionGenerated && v.descriptionApprovedAt) {
      description = v.descriptionGenerated;
    }

    if (v.wovrFlag && !description.toLowerCase().includes("write-off") && !description.toLowerCase().includes("wovr")) {
      description = `Written-off vehicle. ${description}`;
    }

    const title = v.variant ? `${v.year} ${v.make} ${v.model} ${v.variant}` : `${v.year} ${v.make} ${v.model}`;
    const images = (v.images ?? []).slice(0, 20).map(i => i.url);

    const mappedBodyVal = mapEnum(opts.enumMap, "body_type", v.bodyType, { channelName: "meta", required: false });
    const mappedTransmission = mapEnum(opts.enumMap, "transmission", v.transmission, { channelName: "meta", required: false });

    // For Meta Automotive, 'state_of_vehicle' translates our condition
    let stateOfVehicle = "used";
    if (v.condition === "cpo") stateOfVehicle = "cpo";

    const payload: Record<string, string> = {
      id: v.stockNumber || v.vehicleId,
      title: title.slice(0, 150),
      description: description.slice(0, 5000),
      url: listingUrl(v),
      image_url: images[0] || "",
      additional_image_urls: images.slice(1).join(","),
      price: priceStr,
      state_of_vehicle: stateOfVehicle,
      "mileage.value": String(v.odometerKm),
      "mileage.unit": "KM",
      vin: v.vin || "",
      make: v.make,
      model: v.model,
      year: String(v.year),
      body_style: mappedBodyVal.ok && "value" in mappedBodyVal ? mappedBodyVal.value : "",
      transmission: mappedTransmission.ok && "value" in mappedTransmission ? mappedTransmission.value : "",
      exterior_color: v.colourExterior || "",
    };

    return { type: "success", payload, warnings };
  },
};
