/* eslint-disable @typescript-eslint/no-explicit-any --
   Untyped Supabase client: joined rows surface as `any` at this DB boundary. */
import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/config";
import { buildMediaUrl } from "@/lib/media";
import { siteBaseUrl } from "@/lib/seo/site";
import { NAV_BODY_TYPES, BUDGET_BANDS, bodyTypeHref, budgetHref } from "@/lib/nav";

export const revalidate = 3600;

/**
 * XML sitemap.
 *
 * Two correctness rules govern what goes in here:
 *
 *  1. **Only indexable URLs.** A sitemap is a set of canonical, indexable
 *     recommendations. Sold vehicles are now `noindex` (expired inventory), so
 *     listing them told Google to crawl pages we simultaneously ask it not to
 *     index — a contradiction that Search Console reports as "Submitted URL
 *     marked noindex" and that wastes crawl budget on dead stock.
 *  2. **Real `lastModified` values.** Landing pages previously all carried a
 *     hardcoded 2026-01-01 date. A date that never changes trains Google to
 *     stop re-crawling them; landing pages now inherit the freshest
 *     `updated_at` of the inventory they list, so they re-crawl when stock
 *     actually turns over.
 *
 * Vehicle entries also carry `images`, which feeds Google Images — a real
 * discovery channel for car shopping, and free to emit since we already have
 * the URLs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const supabase = createAdminClient();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const staticDate = new Date("2026-01-01T00:00:00Z");

  const [makesRes, modelsRes, vehiclesRes] = await Promise.all([
    supabase.from("makes").select("slug"),
    supabase.from("models").select("slug, makes:make_id ( slug )"),
    supabase
      .from("vehicles")
      .select(
        "slug, updated_at, status, makes:make_id ( slug ), models:model_id ( slug ), vehicle_images ( is_cover, sort_order, media_assets:media_id ( storage_key ) )",
      )
      // `sold` is deliberately excluded — see rule 1 above.
      .in("status", ["available", "reserved"])
      .limit(45000),
  ]);

  const vehicles = ((vehiclesRes.data ?? []) as any[]).filter(
    (v) => v.makes?.slug && v.models?.slug,
  );

  // Freshest inventory timestamp — the honest `lastModified` for every hub and
  // landing page, all of which re-render when stock changes.
  const latestInventoryDate =
    vehicles.reduce<Date>((latest, v) => {
      const d = v.updated_at ? new Date(v.updated_at) : null;
      return d && d > latest ? d : latest;
    }, staticDate) ?? staticDate;

  const url = (
    path: string,
    lastModified: Date | string = staticDate,
    priority = 0.6,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly",
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  });

  // Evergreen informational pages: real content, but they rarely change.
  const staticRoutes = [
    "/sell-your-car", "/trade-in", "/finance", "/about",
    "/testimonials", "/faqs", "/contact", "/how-it-works",
    "/legal/privacy-policy", "/legal/terms", "/legal/disclaimer",
  ].map((p) => url(p, staticDate, 0.7, "monthly"));

  // Inventory hubs turn over daily and deserve the highest crawl priority
  // after the vehicles themselves.
  const hubRoutes = [
    url("/", latestInventoryDate, 1, "daily"),
    url("/used-cars", latestInventoryDate, 0.9, "daily"),
  ];

  // Programmatic landing pages.
  const makeRoutes = ((makesRes.data ?? []) as any[]).map((m) =>
    url(`/used-cars/${m.slug}`, latestInventoryDate, 0.7, "daily"),
  );
  const modelRoutes = ((modelsRes.data ?? []) as any[])
    .filter((m) => m.makes?.slug)
    .map((m) => url(`/used-cars/${m.makes.slug}/${m.slug}`, latestInventoryDate, 0.6, "daily"));
  const bodyRoutes = NAV_BODY_TYPES.map((b) =>
    url(bodyTypeHref(b), latestInventoryDate, 0.7, "daily"),
  );
  const budgetRoutes = BUDGET_BANDS.map((b) =>
    url(budgetHref(b.max), latestInventoryDate, 0.6, "daily"),
  );

  // VDPs — highest-value URLs on the site, with image entries for Google Images.
  const vehicleRoutes = vehicles.map((v) => {
    // Image URLs are derived from the media asset's storage key, the same way
    // `src/lib/data/inventory.ts` builds them for the gallery.
    const images = ((v.vehicle_images ?? []) as any[])
      .slice()
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img) =>
        img.media_assets?.storage_key ? buildMediaUrl(supabaseUrl, img.media_assets.storage_key) : null,
      )
      .filter((url): url is string => Boolean(url));

    return {
      ...url(
        `/used-cars/${v.makes.slug}/${v.models.slug}/${v.slug}`,
        v.updated_at ? new Date(v.updated_at) : staticDate,
        0.8,
        "daily" as const,
      ),
      // Google caps image sitemap entries at 1000 per URL; a listing never has
      // more than a few dozen, so the slice is purely defensive.
      ...(images.length > 0 ? { images: images.slice(0, 50) } : {}),
    };
  });

  return [
    ...hubRoutes,
    ...staticRoutes,
    ...makeRoutes,
    ...modelRoutes,
    ...bodyRoutes,
    ...budgetRoutes,
    ...vehicleRoutes,
  ];
}
