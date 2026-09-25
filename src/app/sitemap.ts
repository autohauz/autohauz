import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/config";
import { buildMediaUrl } from "@/lib/media";
import { siteBaseUrl } from "@/lib/seo/site";
import { isIndexableLanding } from "@/lib/seo/guards";
import { NAV_BODY_TYPES, BUDGET_BANDS, bodyTypeHref, budgetHref, vehicleHref } from "@/lib/nav";

export const revalidate = 3600;

/**
 * XML sitemap — only canonical, indexable URLs.
 *
 *  • Vehicles: available and reserved only (sold cars are `noindex`).
 *  • Make / model / body-type / budget landing pages: only when they carry
 *    enough stock to pass the same thin-page guard the pages themselves apply
 *    (src/lib/seo/guards.ts). A thin landing page is `noindex`, and listing a
 *    noindex URL here contradicts it ("Submitted URL marked noindex").
 *  • Blog: published articles, and categories that contain one.
 *  • lastModified is real: inventory pages take the newest stock change;
 *    evergreen pages carry no date rather than an invented one.
 */
type VehicleRow = {
  slug: string;
  updated_at: string | null;
  status: string;
  price: number | string;
  body_type: string;
  makes: { slug: string } | null;
  models: { slug: string } | null;
  vehicle_images: { is_cover: boolean; sort_order: number | null; media_assets: { storage_key: string } | null }[] | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const supabase = createAdminClient();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");

  const [vehiclesRes, articlesRes, categoriesRes, testimonialsRes] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        "slug, updated_at, status, price, body_type, makes:make_id ( slug ), models:model_id ( slug ), vehicle_images ( is_cover, sort_order, media_assets:media_id ( storage_key ) )",
      )
      .in("status", ["available", "reserved"])
      .limit(45000),
    supabase
      .from("blog_articles")
      .select("slug, updated_at, published_at, category_id, status, scheduled_at")
      .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${new Date().toISOString()})`)
      .limit(5000),
    supabase.from("blog_categories").select("id, slug"),
    supabase.from("testimonials").select("id", { count: "exact", head: true }).eq("is_approved", true),
  ]);

  for (const [name, res] of Object.entries({ vehicles: vehiclesRes, articles: articlesRes, categories: categoriesRes })) {
    if (res.error) console.error(`[sitemap] ${name} query failed:`, res.error.message);
  }

  const vehicles = ((vehiclesRes.data ?? []) as unknown as VehicleRow[]).filter((v) => v.makes?.slug && v.models?.slug);
  const latest = vehicles.reduce<Date | undefined>((acc, v) => {
    const d = v.updated_at ? new Date(v.updated_at) : undefined;
    return d && (!acc || d > acc) ? d : acc;
  }, undefined);

  const entry = (
    path: string,
    opts: { lastModified?: Date; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] },
  ): MetadataRoute.Sitemap[number] => ({ url: `${base}${encodeURI(path)}`, ...opts });

  // Landing-page stock counts, using the same basis as the pages' own guard
  // (available cars).
  const available = vehicles.filter((v) => v.status === "available");
  const tally = (key: (v: VehicleRow) => string) =>
    available.reduce<Map<string, number>>((m, v) => m.set(key(v), (m.get(key(v)) ?? 0) + 1), new Map());
  const byMake = tally((v) => v.makes!.slug);
  const byModel = tally((v) => `${v.makes!.slug}/${v.models!.slug}`);
  const byBody = tally((v) => v.body_type);

  const landing: MetadataRoute.Sitemap = [
    ...[...byMake].filter(([, n]) => isIndexableLanding(n, "makeModel")).map(([slug]) => entry(`/used-cars/${slug}`, { lastModified: latest, priority: 0.7, changeFrequency: "daily" })),
    ...[...byModel].filter(([, n]) => isIndexableLanding(n, "makeModel")).map(([path]) => entry(`/used-cars/${path}`, { lastModified: latest, priority: 0.6, changeFrequency: "daily" })),
    ...NAV_BODY_TYPES.filter((b) => isIndexableLanding(byBody.get(b) ?? 0, "category")).map((b) =>
      entry(bodyTypeHref(b), { lastModified: latest, priority: 0.7, changeFrequency: "daily" }),
    ),
    ...BUDGET_BANDS.filter((band) => isIndexableLanding(available.filter((v) => Number(v.price) <= band.max).length, "category")).map((band) =>
      entry(budgetHref(band.max), { lastModified: latest, priority: 0.6, changeFrequency: "daily" }),
    ),
  ];

  const evergreen = [
    "/sell-your-car", "/trade-in", "/finance", "/about", "/faqs", "/contact", "/how-it-works",
    "/legal/privacy-policy", "/legal/terms", "/legal/disclaimer",
    ...((testimonialsRes.count ?? 0) > 0 ? ["/testimonials"] : []),
  ].map((p) => entry(p, { priority: 0.6, changeFrequency: "monthly" }));

  type ArticleRow = { slug: string; updated_at: string | null; published_at: string | null; category_id: string | null };
  const articles = (articlesRes.data ?? []) as ArticleRow[];
  const usedCategories = new Set(articles.map((a) => a.category_id).filter(Boolean));
  const newestArticle = articles.reduce<Date | undefined>((acc, a) => {
    const d = a.updated_at ? new Date(a.updated_at) : undefined;
    return d && (!acc || d > acc) ? d : acc;
  }, undefined);

  const blog: MetadataRoute.Sitemap = articles.length
    ? [
        entry("/blog", { lastModified: newestArticle, priority: 0.6, changeFrequency: "weekly" }),
        ...((categoriesRes.data ?? []) as { id: string; slug: string }[])
          .filter((c) => usedCategories.has(c.id))
          .map((c) => entry(`/blog/category/${c.slug}`, { lastModified: newestArticle, priority: 0.5, changeFrequency: "weekly" })),
        ...articles.map((a) =>
          entry(`/blog/${a.slug}`, { lastModified: a.updated_at ? new Date(a.updated_at) : undefined, priority: 0.6, changeFrequency: "monthly" }),
        ),
      ]
    : [];

  const vehicleEntries: MetadataRoute.Sitemap = vehicles.map((v) => {
    const images = [...(v.vehicle_images ?? [])]
      .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img) => img.media_assets?.storage_key)
      .filter((key): key is string => Boolean(key) && !/^https?:\/\//i.test(key!))
      .map((key) => buildMediaUrl(supabaseUrl, key))
      .slice(0, 50);
    return {
      ...entry(vehicleHref(v.makes!.slug, v.models!.slug, v.slug), {
        lastModified: v.updated_at ? new Date(v.updated_at) : undefined,
        priority: 0.8,
        changeFrequency: "daily",
      }),
      ...(images.length > 0 ? { images } : {}),
    };
  });

  return [
    entry("/", { lastModified: latest, priority: 1, changeFrequency: "daily" }),
    entry("/used-cars", { lastModified: latest, priority: 0.9, changeFrequency: "daily" }),
    ...evergreen,
    ...landing,
    ...blog,
    ...vehicleEntries,
  ];
}
