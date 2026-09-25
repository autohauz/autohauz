import Link from "next/link";
import { getLeadList } from "@/lib/data/leads";
import { LeadsTable } from "./leads-table";
import type { LeadStatus } from "@/lib/domain";
import { requirePermission } from "@/lib/security/auth";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("leads.view");
  const { status } = await searchParams;
  const active = status ?? "all";
  const leads = await getLeadList({ status: active !== "all" ? (active as LeadStatus) : undefined });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">Respond within 15 minutes during business hours.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "all" ? "/admin/leads" : `/admin/leads?status=${t.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${active === t.value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-body hover:bg-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <LeadsTable data={leads} activeStatus={active} />
    </div>
  );
}
