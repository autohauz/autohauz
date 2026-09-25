"use client";

import { useState, useMemo } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface AuditRow {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_name: string;
  created_at: string;
}

interface AdminAuditTableProps {
  data: AuditRow[];
}

export function AdminAuditTable({ data }: AdminAuditTableProps) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q) ||
        l.actor_name.toLowerCase().includes(q)
    );
  }, [data, search]);

  const columns: DataTableColumn<Record<string, unknown>>[] = [
    {
      key: "action",
      label: "Action",
      sortable: true,
      render: (val) => (
        <Badge variant="outline" className="font-mono text-xs">
          {val as string}
        </Badge>
      ),
    },
    {
      key: "resource_type",
      label: "Resource Type",
      sortable: true,
      render: (val) => (
        <span className="capitalize text-sm">{(val as string).replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "resource_id",
      label: "Resource ID",
      render: (val) => (
        <span className="text-xs font-mono text-muted-foreground">{(val as string).slice(0, 8)}…</span>
      ),
    },
    {
      key: "actor_name",
      label: "Actor",
      sortable: true,
      render: (val) => <span className="font-medium text-foreground">{val as string}</span>,
    },
    {
      key: "created_at",
      label: "Timestamp",
      sortable: true,
      render: (val) => (
        <span className="text-sm text-muted-foreground">
          {new Date(val as string).toLocaleString("en-AU", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filter control */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by action, resource type, or actor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent-bright"
        />
      </div>

      {filteredData.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">No audit logs found.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData as unknown as Record<string, unknown>[]}
          pageSize={20}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
    </div>
  );
}
