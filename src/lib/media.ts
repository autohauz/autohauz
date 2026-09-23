/**
 * Media URL resolution for the used-car schema.
 *
 * Images live in a single public `media` Supabase Storage bucket, referenced by
 * media_assets.storage_key. This builds a direct public URL without needing a
 * Supabase client instance, and provides body-type stock fallbacks so a card is
 * never broken while inventory photography is being loaded.
 */
const MEDIA_BUCKET = "media";

/**
 * Neutral, self-hosted "photo coming soon" artwork. Stock photography was
 * removed (rights unknown, and a random SUV photo on a listing with no photos
 * misrepresents the car).
 */
export const VEHICLE_PLACEHOLDER = "/brand/vehicle-placeholder.svg";

/** Direct public URL for a media_assets.storage_key in the `media` bucket. */
export function buildMediaUrl(supabaseUrl: string, storageKey: string): string {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const encodedKey = storageKey.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${encodedKey}`;
}

const BODY_TYPE_IMAGES: Record<string, string> = {
  sedan: "/brand/body-types/sedan.jpg",
  suv: "/brand/body-types/suv.jpg",
  hatch: "/brand/body-types/hatch.jpg",
  ute: "/brand/body-types/ute.jpg",
  wagon: "/brand/body-types/wagon.jpg",
  coupe: "/brand/body-types/coupe.jpg",
  convertible: "/brand/body-types/convertible.jpg",
  van: "/brand/body-types/van.jpg",
  people_mover: "/brand/body-types/people_mover.jpg",
};

/** Dedicated image getter for Browse By Body Type cards. */
export function getBodyTypeCardImage(bodyType: string): string {
  if (bodyType && BODY_TYPE_IMAGES[bodyType.toLowerCase()]) {
    return BODY_TYPE_IMAGES[bodyType.toLowerCase()];
  }
  return "/brand/body-types/suv.jpg";
}

/** Fallback for inventory vehicles with no uploaded photos (never misrepresents a vehicle with dummy stock photos). */
export function getBodyTypeFallback(): string {
  return VEHICLE_PLACEHOLDER;
}
