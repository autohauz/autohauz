/* eslint-disable @typescript-eslint/no-explicit-any --
   The Supabase client is deliberately untyped (no generated Database types), so
   joined rows and the PostgREST query builder surface as `any` at this boundary.
   Rows are shaped into typed domain projections before leaving this module. */
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv } from "@/lib/config";
import { buildMediaUrl, getBodyTypeFallback } from "@/lib/media";
import type {
  BodyType,
  FacetCount,
  Feature,
  FeatureCategory,
  Make,
  Model,
  VehicleDetail,
  VehicleFilters,
  VehicleImage,
  VehicleListItem,
  VehicleListingResult,
  VehicleSort,
} from "@/lib/domain";

/**
 * Public (buyer-facing) read-side data access for inventory.
 *
 * The Supabase client is untyped; raw rows are `unknown`-ish and shaped into
 * domain projections here. Public reads never select the full VIN.
 */

// Statuses a buyer may see in listings/VDPs (sold stays briefly for social
// proof; the 7-day delist and 60-day archival are enforced by cron + query
// filters — see expire_stale_vdps()).
const PUBLIC_STATUSES = ["available", "reserved", "sold"] as const;

const PER_PAGE = 24;

// PostgREST embeds we reuse for card projections.
// makes/models are !inner so filtering on their columns (e.g. makes.slug) also
// restricts the parent vehicle rows. locations stays a left join (nullable FK).
const CARD_SELECT = `
  id, stock_id, slug, variant, year, mileage_km, fuel_type, transmission, body_type,
  price, previous_price, weekly_estimate, status, is_featured, published_at, sold_at,
  roadworthy_included, finance_available, trade_in_welcome,
  makes:make_id!inner ( name, slug ),
  models:model_id!inner ( name, slug ),
  locations:location_id ( city ),
  vehicle_images ( alt_text, sort_order, is_cover, media_assets:media_id ( storage_key ) )
`;

type RawRow = Record<string, any>;

function pickCover(images: RawRow[] | null | undefined): { key: string | null; alt: string | null } {
  if (!images || images.length === 0) return { key: null, alt: null };
  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const cover = sorted[0];
  const rel = cover?.media_assets;
  const media = Array.isArray(rel) ? rel[0] : rel;
  return { key: media?.storage_key ?? null, alt: cover?.alt_text ?? null };
}

function getGalleryUrls(images: RawRow[] | null | undefined, supabaseUrl: string): string[] {
  if (!images || images.length === 0) return [];
  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted
    .map((img) => {
      const rel = img.media_assets;
      const media = Array.isArray(rel) ? rel[0] : rel;
      return media?.storage_key ? buildMediaUrl(supabaseUrl, media.storage_key) : null;
    })
    .filter((url): url is string => Boolean(url));
}

function toListItem(row: RawRow, supabaseUrl: string): VehicleListItem {
  const cover = pickCover(row.vehicle_images);
  const coverUrl = cover.key
    ? buildMediaUrl(supabaseUrl, cover.key)
    : getBodyTypeFallback(row.body_type as BodyType);
  const galleryUrls = getGalleryUrls(row.vehicle_images, supabaseUrl);
  return {
    id: row.id,
    stockId: row.stock_id,
    slug: row.slug,
    makeSlug: row.makes?.slug ?? "",
    modelSlug: row.models?.slug ?? "",
    makeName: row.makes?.name ?? "",
    modelName: row.models?.name ?? "",
    variant: row.variant ?? null,
    year: row.year,
    mileageKm: row.mileage_km,
    fuelType: row.fuel_type,
    transmission: row.transmission,
    bodyType: row.body_type,
    price: Number(row.price),
    previousPrice: row.previous_price != null ? Number(row.previous_price) : null,
    weeklyEstimate: row.weekly_estimate != null ? Number(row.weekly_estimate) : null,
    status: row.status,
    isFeatured: !!row.is_featured,
    isNewArrival: row.published_at ? Date.now() - new Date(row.published_at).getTime() < 7 * 864e5 : false,
    coverImageUrl: coverUrl,
    coverImageAlt: cover.alt,
    imageUrls: galleryUrls.length > 0 ? galleryUrls : coverUrl ? [coverUrl] : [],
    city: row.locations?.city ?? null,
    roadworthyIncluded: !!row.roadworthy_included,
    financeAvailable: !!row.finance_available,
    tradeInWelcome: !!row.trade_in_welcome,
    publishedAt: row.published_at ?? null,
    soldAt: row.sold_at ?? null,
  };
}

// Apply the shared filter set to a PostgREST query builder.
function applyFilters<T>(query: T, f: VehicleFilters): T {
  // `query` is a PostgREST builder; cast to any for chaining without the
  // generated Database types.
  let q = query as any;
  if (f.make) q = q.eq("makes.slug", f.make);
  if (f.model) q = q.eq("models.slug", f.model);
  if (f.bodyType) q = q.eq("body_type", f.bodyType);
  if (f.fuelType) q = q.eq("fuel_type", f.fuelType);
  if (f.transmission) q = q.eq("transmission", f.transmission);
  if (f.driveType) q = q.eq("drive_type", f.driveType);
  if (f.seats) q = q.eq("seats", f.seats);
  if (f.priceMin != null) q = q.gte("price", f.priceMin);
  if (f.priceMax != null) q = q.lte("price", f.priceMax);
  if (f.yearMin != null) q = q.gte("year", f.yearMin);
  if (f.yearMax != null) q = q.lte("year", f.yearMax);
  if (f.kmMax != null) q = q.lte("mileage_km", f.kmMax);
  // NOTE: city is resolved to location_ids by the caller (locations is a left
  // join, so an embedded-column filter wouldn't restrict parent rows here).
  if (f.q) q = q.textSearch("search_tsv", f.q, { type: "websearch" });
  return q as T;
}

function applySort<T>(query: T, sort: VehicleSort): T {
  const q = query as any;
  switch (sort) {
    case "price_asc":
      return q.order("price", { ascending: true });
    case "price_desc":
      return q.order("price", { ascending: false });
    case "year_desc":
      return q.order("year", { ascending: false });
    case "km_asc":
      return q.order("mileage_km", { ascending: true });
    case "newest":
      return q.order("published_at", { ascending: false, nullsFirst: false });
    case "recommended":
    default:
      return q
        .order("is_featured", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false });
  }
}

function tally(rows: RawRow[], key: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

export async function getVehicleListing(
  filters: VehicleFilters,
  sort: VehicleSort = "recommended",
  page = 1,
  perPage = PER_PAGE,
): Promise<VehicleListingResult> {
  const supabase = createAdminClient();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").trim();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Resolve a city filter to location ids (locations is a left join, so it can't
  // be filtered as an embedded column on the parent query).
  let locationIds: string[] | null = null;
  if (filters.city) {
    const { data: locs } = await supabase.from("locations").select("id").eq("city", filters.city);
    locationIds = ((locs ?? []) as RawRow[]).map((l) => l.id);
    if (locationIds.length === 0) {
      return { items: [], total: 0, page, perPage, facets: { make: [], bodyType: [], fuelType: [], transmission: [] } };
    }
  }
  const withCity = <T,>(q: T): T => (locationIds ? (q as any).in("location_id", locationIds) : q);

  const base = supabase.from("vehicles").select(CARD_SELECT, { count: "exact" }).in("status", PUBLIC_STATUSES);
  const { data, count } = await applySort(withCity(applyFilters(base, filters)), sort).range(from, to);

  // Facets over the same filter set (bounded columns; fine at V1 scale).
  const facetBase = supabase
    .from("vehicles")
    .select("body_type, fuel_type, transmission, makes:make_id!inner ( name, slug )")
    .in("status", PUBLIC_STATUSES);
  const { data: facetRows } = await withCity(applyFilters(facetBase, filters));
  const rows = (facetRows ?? []) as RawRow[];

  const makeTally = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const slug = r.makes?.slug;
    if (!slug) continue;
    const cur = makeTally.get(slug) ?? { label: r.makes?.name ?? slug, count: 0 };
    cur.count += 1;
    makeTally.set(slug, cur);
  }
  const toFacets = (m: Map<string, number>): FacetCount[] =>
    [...m.entries()].map(([value, c]) => ({ value, label: value, count: c })).sort((a, b) => b.count - a.count);

  return {
    items: (data ?? []).map((r: RawRow) => toListItem(r, supabaseUrl)),
    total: count ?? 0,
    page,
    perPage,
    facets: {
      make: [...makeTally.entries()]
        .map(([value, v]) => ({ value, label: v.label, count: v.count }))
        .sort((a, b) => b.count - a.count),
      bodyType: toFacets(tally(rows, "body_type")),
      fuelType: toFacets(tally(rows, "fuel_type")),
      transmission: toFacets(tally(rows, "transmission")),
    },
  };
}

/**
 * Row count for a filter set, without fetching any rows.
 *
 * Used by `generateMetadata` on the programmatic landing pages to decide
 * whether a page has enough stock to be indexed (see `seo/guards.ts`). A
 * `head: true` count query returns no payload, and the result is cached, so
 * the thin-page guard costs a cheap COUNT rather than repeating the page's
 * full listing query — `getVehicleListing` is deliberately uncached because
 * it is per-request and facet-heavy.
 *
 * `city` is intentionally unsupported: no landing page filters by city, and
 * resolving it would need the extra locations round-trip this exists to avoid.
 */
export const getVehicleCount = async (filters: Pick<VehicleFilters, "make" | "model" | "bodyType" | "priceMax">): Promise<number> => {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      // The make/model filters target embedded columns, so the `!inner` joins
      // must be present even though `head: true` returns no rows — without them
      // PostgREST cannot resolve `makes.slug`.
      const base = supabase
        .from("vehicles")
        .select("id, makes:make_id!inner ( slug ), models:model_id!inner ( slug )", {
          count: "exact",
          head: true,
        })
        .in("status", PUBLIC_STATUSES);
      const { count } = (await applyFilters(base, filters)) as { count: number | null };
      return count ?? 0;
    },
    ["vehicle-count", JSON.stringify(filters)],
    { revalidate: 300, tags: ["vehicles"] },
  )();
};

export const getFeaturedVehicles = async (limit = 12): Promise<VehicleListItem[]> => {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").trim();
      const { data } = await supabase
        .from("vehicles")
        .select(CARD_SELECT)
        .eq("status", "available")
        .eq("is_featured", true)
        .order("featured_order", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false })
        .limit(limit);
      const items = (data ?? []).map((r: RawRow) => toListItem(r, supabaseUrl));
      // Backfill with newest available cars if fewer than 4 featured (SRS FR-1).
      if (items.length < 4) {
        const { data: newest } = await supabase
          .from("vehicles")
          .select(CARD_SELECT)
          .eq("status", "available")
          .order("published_at", { ascending: false })
          .limit(limit);
        const seen = new Set(items.map((i) => i.id));
        for (const r of (newest ?? []) as RawRow[]) {
          if (seen.has(r.id)) continue;
          items.push(toListItem(r, supabaseUrl));
          if (items.length >= limit) break;
        }
      }
      return items;
    },
    ["featured-vehicles", String(limit)],
    { revalidate: 900, tags: ["vehicles", "public"] },
  )();
};

export const getVehicleBySlug = async (slug: string): Promise<VehicleDetail | null> => {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").trim();
      const { data: row, error } = await supabase
        .from("vehicles")
        .select(`
          id, stock_id, slug, make_id, model_id, variant, year, mileage_km,
          fuel_type, transmission, body_type, drive_type, engine, power_kw, seats, doors,
          exterior_color, interior, vin, registration, rego_expiry,
          price, previous_price, weekly_estimate, status, is_featured, published_at, sold_at,
          description, safety_rating, warranty_text,
          roadworthy_included, finance_available, trade_in_welcome, inspection_available,
          seo_title, seo_description,
          makes:make_id ( name, slug ),
          models:model_id ( name, slug ),
          locations:location_id ( id, name, slug, address, city, state, postcode, phone, whatsapp, lat, lng, hours ),
          vehicle_images ( id, alt_text, sort_order, is_cover, media_assets:media_id ( storage_key ) ),
          vehicle_features ( features:feature_id ( id, name, slug, category ) )
        `)
        .eq("slug", slug)
        .in("status", PUBLIC_STATUSES)
        .maybeSingle();

      // Throw on a real DB error so unstable_cache does NOT cache a transient
      // failure as a permanent null (which would 404 the VDP until cache expiry).
      // A genuine "not found" (no error, no row) still caches null, as intended.
      if (error) throw new Error(`getVehicleBySlug failed: ${error.message}`);
      if (!row) return null;
      const r = row as RawRow;
      const base = toListItem(r, supabaseUrl);

      const images: VehicleImage[] = ((r.vehicle_images ?? []) as RawRow[])
        .map((img) => {
          const rel = img.media_assets;
          const media = Array.isArray(rel) ? rel[0] : rel;
          return {
            id: img.id,
            url: media?.storage_key ? buildMediaUrl(supabaseUrl, media.storage_key) : getBodyTypeFallback(r.body_type as BodyType),
            altText: img.alt_text ?? null,
            sortOrder: img.sort_order ?? 0,
            isCover: !!img.is_cover,
          };
        })
        .sort((a, b) => {
          if (a.isCover && !b.isCover) return -1;
          if (!a.isCover && b.isCover) return 1;
          return a.sortOrder - b.sortOrder;
        });

      const features: Feature[] = ((r.vehicle_features ?? []) as RawRow[])
        .map((vf) => vf.features)
        .filter(Boolean)
        .map((f: RawRow) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          category: f.category as FeatureCategory,
        }));

      const vin: string | null = r.vin ?? null;

      return {
        ...base,
        makeId: r.make_id,
        modelId: r.model_id,
        driveType: r.drive_type ?? null,
        engine: r.engine ?? null,
        powerKw: r.power_kw ?? null,
        seats: r.seats ?? null,
        doors: r.doors ?? null,
        exteriorColor: r.exterior_color ?? null,
        interior: r.interior ?? null,
        // Only the last 6 chars are exposed publicly (SRS §13.1).
        vinMasked: vin ? `••••${vin.slice(-6)}` : null,
        registration: r.registration ?? null,
        regoExpiry: r.rego_expiry ?? null,
        description: r.description ?? null,
        safetyRating: r.safety_rating ?? null,
        warrantyText: r.warranty_text ?? null,
        inspectionAvailable: !!r.inspection_available,
        seoTitle: r.seo_title ?? null,
        seoDescription: r.seo_description ?? null,
        images,
        features,
        location: r.locations
          ? {
              id: r.locations.id,
              name: r.locations.name,
              slug: r.locations.slug,
              address: r.locations.address,
              city: r.locations.city,
              state: r.locations.state,
              postcode: r.locations.postcode ?? null,
              phone: r.locations.phone ?? null,
              whatsapp: r.locations.whatsapp ?? null,
              lat: r.locations.lat ?? null,
              lng: r.locations.lng ?? null,
              hours: r.locations.hours ?? {},
            }
          : null,
        tiktokEmbedHtml: null,
      };
    },
    ["vehicle-detail", slug],
    { revalidate: 900, tags: ["vehicles", "public"] },
  )();
};

/** Minimal vehicle context for lead pages reached via ?vehicle={id}. */
export async function getVehicleLeadContext(
  id: string,
): Promise<{ id: string; title: string; price: number } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, year, variant, price, makes:make_id ( name ), models:model_id ( name )")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as RawRow;
  return {
    id: r.id,
    title: `${r.year} ${r.makes?.name ?? ""} ${r.models?.name ?? ""}${r.variant ? ` ${r.variant}` : ""}`.trim(),
    price: Number(r.price),
  };
}

export async function getSimilarVehicles(
  vehicle: Pick<VehicleDetail, "id" | "bodyType" | "price">,
  limit = 6,
): Promise<VehicleListItem[]> {
  const supabase = createAdminClient();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").trim();
  const { data } = await supabase
    .from("vehicles")
    .select(CARD_SELECT)
    .eq("status", "available")
    .eq("body_type", vehicle.bodyType)
    .neq("id", vehicle.id)
    .gte("price", vehicle.price * 0.8)
    .lte("price", vehicle.price * 1.2)
    .limit(limit);
  return (data ?? []).map((r: RawRow) => toListItem(r, supabaseUrl));
}

export const getMakes = unstable_cache(
  async (): Promise<Make[]> => {
    const supabase = createAdminClient();
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").trim();
    const { data } = await supabase
      .from("makes")
      .select("id, name, slug, is_popular, media_assets:logo_media_id ( storage_key )")
      .order("name", { ascending: true });
    return ((data ?? []) as RawRow[]).map((m) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      isPopular: !!m.is_popular,
      logoUrl: m.media_assets?.storage_key ? buildMediaUrl(supabaseUrl, m.media_assets.storage_key) : null,
    }));
  },
  ["makes"],
  { revalidate: 3600, tags: ["makes", "public"] },
);

/** All models (for the admin cascading make→model select). */
export async function getAllModels(): Promise<Model[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("models").select("id, make_id, name, slug").order("name");
  return ((data ?? []) as RawRow[]).map((m) => ({ id: m.id, makeId: m.make_id, name: m.name, slug: m.slug }));
}

/** All features grouped for the admin form. */
export async function getAllFeatures(): Promise<Feature[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("features").select("id, name, slug, category").order("category").order("name");
  return ((data ?? []) as RawRow[]).map((f) => ({ id: f.id, name: f.name, slug: f.slug, category: f.category }));
}

export const getModelsForMake = async (makeSlug: string): Promise<Model[]> => {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("models")
        .select("id, make_id, name, slug, makes:make_id!inner ( slug )")
        .eq("makes.slug", makeSlug)
        .order("name", { ascending: true });
      return ((data ?? []) as RawRow[]).map((m) => ({
        id: m.id,
        makeId: m.make_id,
        name: m.name,
        slug: m.slug,
      }));
    },
    ["models-for-make", makeSlug],
    { revalidate: 3600, tags: ["makes", "public"] },
  )();
};

export type { VehicleFilters, VehicleSort };
