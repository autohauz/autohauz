import "server-only";
import { requirePermission } from "@/lib/security/auth";
/* eslint-disable @typescript-eslint/no-explicit-any --
   Untyped Supabase client: rows surface as `any` and are shaped into typed
   projections before leaving this module. */
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin dashboard + inventory read-side (SRS §15.1–15.2).
 * Every export checks the caller's permission before reading with the
 * service-role client.
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

/** A 'new' lead older than this has breached the first-response SLA (SRS §2.8). */
const SLA_MINUTES = 15;

const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost", "spam"] as const;
const VEHICLE_STATUSES = ["draft", "available", "reserved", "sold", "archived"] as const;

/**
 * Real dashboard KPIs, as parallel COUNT queries (no rows are transferred).
 *
 * Computed here rather than by the get_admin_dashboard_metrics() RPC: that
 * RPC authorises through admin_roles, so it refuses staff whose access comes
 * from the env bootstrap allowlist — which is why the dashboard had been
 * stubbed with invented numbers. Authorization happens in the caller.
 */
async function loadDashboardMetrics(): Promise<DashboardMetrics | null> {
  const supabase = createAdminClient();
  const count = async (table: "leads" | "vehicles", status?: string, olderThan?: string) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    if (olderThan) q = q.lt("created_at", olderThan);
    const { count: n, error } = await q;
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    return n ?? 0;
  };
  const slaCutoff = new Date(Date.now() - SLA_MINUTES * 60_000).toISOString();

  try {
    const [leadTotal, vehicleTotal, slaBreaches, leadCounts, vehicleCounts] = await Promise.all([
      count("leads"),
      count("vehicles"),
      count("leads", "new", slaCutoff),
      Promise.all(LEAD_STATUSES.map((s) => count("leads", s))),
      Promise.all(VEHICLE_STATUSES.map((s) => count("vehicles", s))),
    ]);
    const leads = Object.fromEntries(LEAD_STATUSES.map((s, i) => [s, leadCounts[i]])) as Record<(typeof LEAD_STATUSES)[number], number>;
    const inventory = Object.fromEntries(VEHICLE_STATUSES.map((s, i) => [s, vehicleCounts[i]])) as Record<(typeof VEHICLE_STATUSES)[number], number>;
    return {
      leads: { total: leadTotal, ...leads, awaiting_first_contact: leads.new, sla_breaches: slaBreaches },
      inventory: { total: vehicleTotal, ...inventory },
    };
  } catch (err) {
    console.error("[dashboard] metrics failed:", err instanceof Error ? err.message : err);
    return null; // the page shows "Could not load metrics" rather than wrong numbers
  }
}

export async function getAdminDashboardMetrics(): Promise<DashboardMetrics | null> {
  await requirePermission("dashboard.view");
  return unstable_cache(loadDashboardMetrics, ["admin-dashboard-metrics"], { revalidate: 60, tags: ["vehicles", "leads"] })();
}

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
export const getInventoryList = async (filters?: { status?: string; q?: string }): Promise<InventoryListRow[]> => {
  await requirePermission("inventory.view");
  return unstable_cache(
    async () => _getInventoryList(filters),
    ["admin-inventory-list", JSON.stringify(filters || {})],
    { revalidate: 30, tags: ["vehicles"] },
  )();
};
