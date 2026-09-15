import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { getInventoryList } from "@/lib/data/dashboard";
import { formatPrice } from "@/lib/nav";
import { InventoryRowActions } from "./inventory-row-actions";
import { SyndicationBackfillBanner } from "@/components/admin/syndication-backfill-banner";
import { BulkUpload } from "./bulk-upload";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-success/10 text-success",
  reserved: "bg-warning/10 text-warning",
  sold: "bg-muted text-muted-foreground",
  draft: "bg-primary/10 text-primary",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_TABS = ["all", "available", "reserved", "draft", "sold", "archived"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const status = resolvedSearchParams?.status;
  const rows = await getInventoryList({ status: status && status !== "all" ? status : undefined });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">{rows.length} vehicles</p>
        </div>
        <Link href="/admin/inventory/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
          <Plus className="size-4" /> Add vehicle
        </Link>
      </header>

      <SyndicationBackfillBanner />
      <BulkUpload />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/admin/inventory" : `/admin/inventory?status=${t}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${(status ?? "all") === t ? "bg-primary text-primary-foreground" : "border border-border bg-card text-body hover:bg-muted"}`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3">Stock</th><th className="p-3">Vehicle</th><th className="p-3">Price</th>
              <th className="p-3">Status</th><th className="p-3">Views</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No vehicles. <Link href="/admin/inventory/new" className="text-primary hover:underline">Add your first car</Link>.</td></tr>
            ) : rows.map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="p-3 font-mono text-xs text-muted-foreground">{v.stockId}</td>
                <td className="p-3">
                  <span className="font-medium text-foreground">{v.title}</span>
                  {v.isFeatured ? <Star className="ml-1 inline size-3.5 fill-warning text-warning" /> : null}
                </td>
                <td className="p-3 tabular-nums text-foreground">{formatPrice(v.price)}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[v.status] ?? ""}`}>{v.status}</span></td>
                <td className="p-3 tabular-nums text-muted-foreground">{v.viewsCount}</td>
                <td className="p-3 text-right">
                  <InventoryRowActions vehicleId={v.id} currentStatus={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
