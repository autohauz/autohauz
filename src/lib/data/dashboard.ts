/* eslint-disable @typescript-eslint/no-explicit-any --
   Untyped Supabase client: rows surface as `any` and are shaped into typed
   projections before leaving this module. */
import { unstable_cache } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin dashboard + inventory read-side (SRS §15.1–15.2).
 * Metrics run through the acting user's session so the RPC's is_staff() guard
 * applies; list queries use the admin client after the page-level requireAdmin.
 */

export type DashboardMetrics = {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    won: number;
    lost: number;
    spam: number;
    awaiting_first_contact: number;
    sla_breaches: number;
  };
  inventory: {
    total: number;
    draft: number;
    available: number;
    reserved: number;
    sold: number;
    archived: number;
  };
};

async function _getAdminDashboardMetrics(): Promise<DashboardMetrics | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_admin_dashboard_metrics", { p_sla_minutes: 15 });
  if (error || !data) return null;
  return data as DashboardMetrics;
}

/**
 * Cached for 60 s so rapid admin navigation doesn't hammer the RPC.
 * Revalidate tag "dashboard" to bust manually after mutations.
 */
export const getAdminDashboardMetrics = unstable_cache(
  _getAdminDashboardMetrics,
  ["admin-dashboard-metrics"],
  { revalidate: 60, tags: ["dashboard"] },
);

type RawRow = Record<string, any>;

export type InventoryListRow = {
  id: string;
  stockId: string;
  slug: string;
  title: string;
  price: number;
  status: string;
  isFeatured: boolean;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
};

async function _getInventoryList(filters?: { status?: string; q?: string }): Promise<InventoryListRow[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("vehicles")
    .select(`
      id, stock_id, slug, variant, year, price, status, is_featured, views_count,
      published_at, created_at,
      makes:make_id ( name ), models:model_id ( name )
    `)
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.q) q = q.ilike("stock_id", `%${filters.q}%`);
  const { data } = await q;
  return ((data ?? []) as RawRow[]).map((r) => ({
    id: r.id,
    stockId: r.stock_id,
    slug: r.slug,
    title: `${r.year} ${r.makes?.name ?? ""} ${r.models?.name ?? ""}${r.variant ? ` ${r.variant}` : ""}`.trim(),
    price: Number(r.price),
    status: r.status,
    isFeatured: !!r.is_featured,
    viewsCount: r.views_count ?? 0,
    publishedAt: r.published_at ?? null,
    createdAt: r.created_at,
  }));
}

/**
 * Cached for 30 s — rapid tab switching won't re-query 200 rows each time.
 * Revalidate tag "vehicles" to bust after add/edit/delete.
 */
export const getInventoryList = unstable_cache(
  _getInventoryList,
  ["admin-inventory-list"],
  { revalidate: 30, tags: ["vehicles"] },
);
