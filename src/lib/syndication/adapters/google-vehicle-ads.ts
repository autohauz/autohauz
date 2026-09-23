import type { CanonicalVehicle } from "../types";
import type { ChannelAdapter, TransformResult } from "./types";
import { evaluateReadiness } from "../readiness";
import { mapEnum, type EnumMap } from "../enum-map";
import { listingUrl } from "@/lib/syndication/listing-url";

/**
 * F10: Frozen headers for Google Vehicle Ads.
 * Must match Merchant Center requirements byte-for-byte.
 */
export const GOOGLE_VEHICLE_ADS_HEADERS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "price",
  "condition",
  "vin",
  "vehicle_fulfillment",
  "store_code",
  "mileage",
  "color",
  "year",
  "make",
  "model",
  "body_style",
  "transmission",
] as const;

export const GoogleVehicleAdsAdapter: ChannelAdapter = {
  code: "google_vehicle_ads",
  name: "Google Vehicle Ads",

  transform(v: CanonicalVehicle, opts: { vinDuplicates?: ReadonlySet<string>; storeCode?: string; enumMap: EnumMap }): TransformResult {
    // 1. Evaluate base channel-agnostic readiness
    const baseReadiness = evaluateReadiness(v, { vinDuplicates: opts.vinDuplicates });
    const rejections = [...baseReadiness.rejections];
    const warnings = [...baseReadiness.warnings];

    // 2. Google-specific validations
    if (!opts.storeCode) {
      rejections.push({
        code: "MISSING_STORE_CODE",
        field: "store_code",
        message: "Google requires a store code mapping to a verified Business Profile.",
        fixHint: "Configure the store code in the channel settings.",
      });
    }

    if (v.bodyType) {
      const mappedBody = mapEnum(opts.enumMap, "body_type", v.bodyType);
      if (!mappedBody.ok) {
        rejections.push({
          code: "UNMAPPED_ENUM",
          field: "bodyType",
          message: `Body type "${v.bodyType}" is not mapped for Google.`,
          fixHint: "Update the channel mapping for this body type.",
        });
      } else if (mappedBody.value === "UNSUPPORTED") {
        rejections.push({
          code: "VEHICLE_TYPE_UNSUPPORTED",
          field: "bodyType",
          message: "Google Vehicle Ads only supports passenger vehicles and utes. Motorhomes/boats/commercial are rejected.",
          fixHint: "This vehicle cannot be published to Google.",
        });
      }
    }

    const mappedCondition = mapEnum(opts.enumMap, "condition", v.condition);
    if (!mappedCondition.ok) {
      rejections.push({
        code: "UNMAPPED_ENUM",
        field: "condition",
        message: `Condition "${v.condition}" is not mapped for Google.`,
        fixHint: "Update the channel mapping.",
      });
    }

    if (rejections.length > 0) {
      return { type: "rejected", rejections, warnings };
    }

    // 3. Construct payload (Pure: no I/O)
    // F8: Google landing page price must match feed price.
    // Price must include currency.
    const priceStr = `${v.priceAmount} ${v.currency}`;

    // Description falls back to raw if generated isn't approved
    let description = v.descriptionRaw ?? "";
    if (v.descriptionGenerated && v.descriptionApprovedAt) {
      description = v.descriptionGenerated;
    }
    // F27: WOVR disclosure
    if (v.wovrFlag && !description.toLowerCase().includes("write-off") && !description.toLowerCase().includes("wovr")) {
      description = `Written-off vehicle. ${description}`;
    }

    const title = v.variant ? `${v.year} ${v.make} ${v.model} ${v.variant}` : `${v.year} ${v.make} ${v.model}`;
    const images = (v.images ?? []).slice(0, 10).map(i => i.url);

    const mappedBodyVal = mapEnum(opts.enumMap, "body_type", v.bodyType, { channelName: "google", required: false });
    const mappedTransmission = mapEnum(opts.enumMap, "transmission", v.transmission, { channelName: "google", required: false });

    const payload: Record<string, string> = {
      id: v.stockNumber || v.vehicleId,
      title: title.slice(0, 150), // F29: title limit
      description: description.slice(0, 5000),
      link: listingUrl(v),
      image_link: images[0] || "",
      additional_image_link: images.slice(1).join(","),
      price: priceStr,
      condition: mappedCondition.ok && "value" in mappedCondition ? mappedCondition.value : "",
      vin: v.vin || "",
      vehicle_fulfillment: `in_store:${opts.storeCode}`,
      store_code: opts.storeCode || "",
      mileage: `${v.odometerKm} km`, // F7: explicitly km
      color: v.colourExterior || "",
      year: String(v.year),
      make: v.make,
      model: v.model,
      body_style: mappedBodyVal.ok && "value" in mappedBodyVal ? mappedBodyVal.value : "",
      transmission: mappedTransmission.ok && "value" in mappedTransmission ? mappedTransmission.value : "",
    };

    return { type: "success", payload, warnings };
  },
};
