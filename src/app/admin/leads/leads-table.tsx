"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { LEAD_STATUS_LABELS, LEAD_STATUS_STYLES, LEAD_TYPE_LABELS } from "@/lib/leads/status";
import type { Lead, LeadType, LeadStatus } from "@/lib/domain";

interface LeadsTableProps {
  data: Lead[];
  activeStatus: string;
}

export function LeadsTable({ data, activeStatus }: LeadsTableProps) {
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(() => [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (val) => <span className="font-medium text-foreground">{val as string}</span>,
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (val) => <span className="text-body">{LEAD_TYPE_LABELS[val as LeadType]}</span>,
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      render: (val) => <span className="tabular-nums text-body">{val as string}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEAD_STATUS_STYLES[val as LeadStatus] ?? ""}`}>
          {LEAD_STATUS_LABELS[val as LeadStatus]}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Received",
      sortable: true,
      render: (val) => (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(val as string), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "id",
      label: "",
      render: (val) => (
        <div className="text-right">
          <Link href={`/admin/leads/${val}`} className="text-primary hover:underline">
            Open
          </Link>
        </div>
      ),
    },
  ], []);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No leads {activeStatus !== "all" ? `with status “${activeStatus}”` : "yet"}.
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
