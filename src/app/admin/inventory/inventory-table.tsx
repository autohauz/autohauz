"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { formatPrice } from "@/lib/nav";
import { InventoryRowActions } from "./inventory-row-actions";
import type { InventoryListRow } from "@/lib/data/dashboard";

const STATUS_STYLES: Record<string, string> = {
  available: "bg-success/10 text-success",
  reserved: "bg-warning/10 text-warning",
  sold: "bg-muted text-muted-foreground",
  draft: "bg-primary/10 text-primary",
  archived: "bg-muted text-muted-foreground",
};

interface InventoryTableProps {
  data: InventoryListRow[];
}

export function InventoryTable({ data }: InventoryTableProps) {
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(() => [
    {
      key: "stockId",
      label: "Stock",
      sortable: true,
      render: (val) => <span className="font-mono text-xs text-muted-foreground">{val as string}</span>,
    },
    {
      key: "title",
      label: "Vehicle",
      sortable: true,
      render: (val, row) => (
        <>
          <span className="font-medium text-foreground">{val as string}</span>
          {(row.isFeatured as boolean) ? (
            <Star className="ml-1 inline size-3.5 fill-warning text-warning" />
          ) : null}
        </>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      numeric: true,
      render: (val) => <span className="text-foreground">{formatPrice(val as number)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[val as string] ?? ""}`}
        >
          {val as string}
        </span>
      ),
    },
    {
      key: "viewsCount",
      label: "Views",
      sortable: true,
      numeric: true,
      render: (val) => <span className="text-muted-foreground">{val as number}</span>,
    },
    {
      key: "id",
      label: "",
      render: (val, row) => (
        <div className="text-right">
          <InventoryRowActions vehicleId={val as string} currentStatus={row.status as string} />
        </div>
      ),
    },
  ], []);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No vehicles.{" "}
        <Link href="/admin/inventory/new" className="text-primary hover:underline">
          Add your first car
        </Link>
        .
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data as unknown as Record<string, unknown>[]}
      pageSize={24}
      pageSizeOptions={[12, 24, 48]}
    />
  );
}
