import { VEHICLE_PLACEHOLDER } from "@/lib/media";

/**
 * image-utils.ts — resolves vehicle image URLs from Supabase Storage for the
 * search index and gallery, falling back to the neutral placeholder.
 */

/** Minimal image record returned from vehicle_images join */
export type VehicleImageRecord = {
  storage_path: string;
  approved: boolean;
  sort_order: number;
};

/** Category fallback — always the neutral placeholder (no stock photos). */
export function getCategoryFallback(): string {
  return VEHICLE_PLACEHOLDER;
}

/**
 * Build a Supabase Storage public URL for a vehicle_images row.
 *
 * @param supabaseUrl  process.env.NEXT_PUBLIC_SUPABASE_URL
 * @param img          A row from vehicle_images (needs storage_path + approved)
 */
export function buildStorageUrl(supabaseUrl: string, img: VehicleImageRecord): string {
  const bucket = img.approved ? "vehicle-images" : "pending-vehicle-images";
  // Construct direct public URL — avoids instantiating a Supabase client just for this
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${img.storage_path}`;
}

/**
 * Resolve the best displayable image URL for a vehicle given a list of
 * vehicle_images rows (already fetched from Supabase).
 *
 * Preference order:
 *   1. First approved image (lowest sort_order)
 *   2. First any image (lowest sort_order)  — so pending-org images still show
 *   3. Category stock photo fallback
 *
 * @param supabaseUrl   process.env.NEXT_PUBLIC_SUPABASE_URL
 * @param images        Rows from vehicle_images join
 */
export function resolveVehicleImage(
  supabaseUrl: string,
  images: VehicleImageRecord[] | null | undefined,
): string {
  if (!images || images.length === 0) {
    return getCategoryFallback();
  }

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);
  // Prefer approved (public bucket) first; fall back to any image
  const best = sorted.find((img) => img.approved) ?? sorted[0];
  return buildStorageUrl(supabaseUrl, best);
}

/**
 * Resolve ALL images for the detail-page gallery.
 * Returns an array of { url, alt_text } objects ready for <ImageGallery>.
 *
 * @param supabaseUrl   process.env.NEXT_PUBLIC_SUPABASE_URL
 * @param images        Rows from vehicle_images join (must include alt_text)
 * @param vehicleTitle  Used for default alt text
 */
export type GalleryImage = {
  id: string;
  url: string;
  alt_text: string;
};

export type FullImageRecord = VehicleImageRecord & {
  id: string;
  alt_text: string | null;
};

export function resolveGalleryImages(
  supabaseUrl: string,
  images: FullImageRecord[] | null | undefined,
  vehicleTitle: string,
): GalleryImage[] {
  if (!images || images.length === 0) return [];

  return [...images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((img) => ({
      id: img.id,
      url: buildStorageUrl(supabaseUrl, img),
      alt_text: img.alt_text || `${vehicleTitle} rental car image`,
    }));
}

type FallbackVehicle = {
  title?: string;
  category?: string;
  vehicle_images?: FullImageRecord[];
  featuredImage?: string;
  image?: string;
  thumbnail?: string;
  images?: unknown[];
  gallery?: unknown[];
  [key: string]: unknown;
};

/**
 * Resolves a list of GalleryImage objects for a vehicle.
 * Combines Supabase database images with standard and custom image fields,
 * and falls back to a category-specific stock photo placeholder if all fields are empty.
 */
export function getVehicleImages(vehicle: FallbackVehicle): GalleryImage[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const title = vehicle.title || "Rental Car";
  
  // 1. Collect from database vehicle_images relation
  const dbImages = vehicle.vehicle_images || [];
  const galleryImages = resolveGalleryImages(supabaseUrl, dbImages, title);
  
  // 2. Collect other potential custom/standard fields defensively
  const rawUrls: string[] = [];
  if (typeof vehicle.featuredImage === "string" && vehicle.featuredImage.trim()) {
    rawUrls.push(vehicle.featuredImage);
  }
  if (typeof vehicle.image === "string" && vehicle.image.trim()) {
    rawUrls.push(vehicle.image);
  }
  if (typeof vehicle.thumbnail === "string" && vehicle.thumbnail.trim()) {
    rawUrls.push(vehicle.thumbnail);
  }
  
  const extractUrl = (img: unknown) => {
    if (typeof img === "string" && img.trim()) {
      rawUrls.push(img);
    } else if (img && typeof img === "object" && "url" in img) {
      const urlStr = (img as Record<string, unknown>).url;
      if (typeof urlStr === "string" && urlStr.trim()) {
        rawUrls.push(urlStr);
      }
    }
  };

  if (Array.isArray(vehicle.images)) {
    vehicle.images.forEach(extractUrl);
  }
  
  if (Array.isArray(vehicle.gallery)) {
    vehicle.gallery.forEach(extractUrl);
  }
  
  const customImages: GalleryImage[] = rawUrls.map((url, index) => ({
    id: `custom-img-${index}-${Date.now()}`,
    url,
    alt_text: `${title} rental car image`,
  }));
  
  const combined = [...galleryImages, ...customImages];
  
  // 3. Fallback to category stock photo if completely empty
  if (combined.length === 0) {
    const fallbackUrl = getCategoryFallback();
    return [
      {
        id: "fallback-category-stock",
        url: fallbackUrl,
        alt_text: `${title} placeholder stock image`,
      },
    ];
  }
  
  return combined;
}
