import Link from "next/link";
import { Plus } from "lucide-react";
import { getInventoryList } from "@/lib/data/dashboard";

import { InventoryTable } from "./inventory-table";
import { SyndicationBackfillBanner } from "@/components/admin/syndication-backfill-banner";
import { BulkUpload } from "./bulk-upload";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";



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

      <InventoryTable data={rows} />
    </div>
  );
}
