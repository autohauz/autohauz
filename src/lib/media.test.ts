import { describe, expect, it } from "vitest";
import { buildMediaUrl, VEHICLE_PLACEHOLDER } from "./media";

const SUPA = "https://abc.supabase.co";

describe("buildMediaUrl", () => {
  it("builds public URLs for storage keys, encoding each segment", () => {
    expect(buildMediaUrl(SUPA, "vehicles/a b.webp")).toBe(`${SUPA}/storage/v1/object/public/media/vehicles/a%20b.webp`);
  });

  it("keeps absolute URLs on our own storage", () => {
    const own = `${SUPA}/storage/v1/object/public/media/vehicles/x.webp`;
    expect(buildMediaUrl(SUPA, own)).toBe(own);
  });

  it("never renders a third-party image as a vehicle photo", () => {
    expect(buildMediaUrl(SUPA, "https://images.unsplash.com/photo-1?w=1200")).toBe(VEHICLE_PLACEHOLDER);
    expect(buildMediaUrl(SUPA, "http://example.com/x.jpg")).toBe(VEHICLE_PLACEHOLDER);
  });
});
