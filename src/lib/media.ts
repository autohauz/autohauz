/**
 * Media URL resolution for the used-car schema.
 *
 * Images live in a single public `media` Supabase Storage bucket, referenced by
 * media_assets.storage_key. This builds a direct public URL without needing a
 * Supabase client instance, and provides body-type stock fallbacks so a card is
 * never broken while inventory photography is being loaded.
 */
import type { BodyType } from "@/lib/domain";

const MEDIA_BUCKET = "media";

const BODY_TYPE_FALLBACK: Record<BodyType, string> = {
  sedan: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80",
  suv: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=800&q=80",
  hatch: "https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&w=800&q=80",
  ute: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80",
  wagon: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
  coupe: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80",
  convertible: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80",
  van: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=800&q=80",
  people_mover: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
};

const GENERIC_FALLBACK =
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80";

/** Direct public URL for a media_assets.storage_key in the `media` bucket. */
export function buildMediaUrl(supabaseUrl: string, storageKey: string): string {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return storageKey;
  }
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const encodedKey = storageKey.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${encodedKey}`;
}

/** Body-type stock fallback (never a broken image). */
export function getBodyTypeFallback(bodyType?: BodyType | null): string {
  return (bodyType && BODY_TYPE_FALLBACK[bodyType]) ?? GENERIC_FALLBACK;
}
