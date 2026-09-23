import type { CanonicalVehicle } from "../types";
import type { ChannelAdapter, TransformResult } from "./types";
import { evaluateReadiness } from "../readiness";
import { listingUrl } from "@/lib/syndication/listing-url";

/**
 * Meta Commerce Catalog (Standard Product) for WhatsApp.
 * Unlike Meta Marketplace Vehicles which uses automotive-specific fields,
 * WhatsApp catalogues use standard commerce fields.
 */
export const WHATSAPP_CATALOG_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "brand"
] as const;

export const WhatsAppCatalogAdapter: ChannelAdapter = {
  code: "whatsapp_catalog",
  name: "WhatsApp Catalogue",

  transform(v: CanonicalVehicle, opts: { vinDuplicates?: ReadonlySet<string>; storeCode?: string }): TransformResult {
    // 1. Evaluate base channel-agnostic readiness
    const baseReadiness = evaluateReadiness(v, { vinDuplicates: opts.vinDuplicates });
    const rejections = [...baseReadiness.rejections];
    const warnings = [...baseReadiness.warnings];

    if (rejections.length > 0) {
      return { type: "rejected", rejections, warnings };
    }

    // 2. Construct Payload
    // WhatsApp catalog uses basic fields. We deep-link to the VDP.
    const priceStr = `${v.priceAmount} ${v.currency}`;

    let description = v.descriptionRaw ?? "";
    if (v.descriptionGenerated && v.descriptionApprovedAt) {
      description = v.descriptionGenerated;
    }
    // Very short summary for WhatsApp
    description = description.slice(0, 100) + (description.length > 100 ? "..." : "");

    if (v.wovrFlag) {
      description = `Written-off vehicle. ${description}`;
    }

    const title = v.variant ? `${v.year} ${v.make} ${v.model} ${v.variant}` : `${v.year} ${v.make} ${v.model}`;
    const image = v.images && v.images.length > 0 ? v.images[0].url : "";

    const payload: Record<string, string> = {
      id: v.stockNumber || v.vehicleId,
      title: title.slice(0, 150),
      description: description,
      availability: "in stock",
      condition: "used",
      price: priceStr,
      link: listingUrl(v),
      image_link: image,
      brand: v.make
    };

    return { type: "success", payload, warnings };
  },
};
