"use client";

import { useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/invoices/status";
import type { InvoiceListRow } from "@/lib/data/invoices";
import type { InvoiceStatus } from "@/lib/domain";

interface InvoicesTableProps {
  data: InvoiceListRow[];
  activeStatus: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export function InvoicesTable({ data, activeStatus }: InvoicesTableProps) {
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(() => [
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      render: (val) => <span className="font-semibold">{val ? (val as string) : "Draft"}</span>,
    },
    {
      key: "billingName",
      label: "Customer",
      sortable: true,
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{val as string}</span>
          {Boolean(row.leadName) && row.leadName !== val && (
            <span className="text-xs text-muted-foreground">Lead: {String(row.leadName)}</span>
          )}
        </div>
      ),
    },
    {
      key: "vehicleTitle",
      label: "Vehicle",
      sortable: true,
      render: (val) => <span className="text-body text-sm max-w-[200px] truncate block" title={val as string | undefined}>{val as string || "—"}</span>,
    },
    {
      key: "totalIncGstCents",
      label: "Total",
      sortable: true,
      render: (val) => <span className="tabular-nums font-semibold">{formatCurrency(val as number)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (val, row) => {
        const isOverdue = row.isOverdue as boolean;
        const statusKey = isOverdue ? "overdue" : (val as InvoiceStatus);
        return (
          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${INVOICE_STATUS_STYLES[statusKey] ?? ""}`}>
            {INVOICE_STATUS_LABELS[statusKey]}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (val, row) => {
        const dateString = (row.issuedAt || row.createdAt) as string;
        return (
          <span className="text-muted-foreground tabular-nums">
            {formatDistanceToNow(new Date(dateString), { addSuffix: true })}
          </span>
        );
      },
    },
    {
      key: "id",
      label: "",
      render: (val, row) => (
        <div className="text-right">
          <Link href={`/admin/invoices/${val}`} className="text-primary hover:underline text-sm font-medium">
            {row.status === "draft" ? "Edit" : "View"}
          </Link>
        </div>
      ),
    },
  ], []);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        No invoices {activeStatus !== "all" ? `with status “${activeStatus}”` : "found"}.
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
