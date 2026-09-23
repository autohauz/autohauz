import Link from "next/link";
import { PlusCircle, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { getInvoiceList, getInvoicesKPIs } from "@/lib/data/invoices";
import { InvoicesTable } from "./invoices-table";
import { Card, CardContent } from "@/components/ui/card";
import type { InvoiceStatus } from "@/lib/domain";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active = status ?? "all";
  
  const [invoices, kpis] = await Promise.all([
    getInvoiceList({ status: active !== "all" ? (active as InvoiceStatus) : undefined }),
    getInvoicesKPIs(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage and track billing.</p>
        </div>
        <Link 
          href="/admin/invoices/new" 
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Create Invoice
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Invoiced</p>
              <p className="text-2xl font-bold font-heading tabular-nums">{formatCurrency(kpis.totalInvoicedCents)}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold font-heading tabular-nums">{formatCurrency(kpis.totalPaidCents)}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-warning/10 flex items-center justify-center text-warning">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold font-heading tabular-nums">{formatCurrency(kpis.totalOutstandingCents)}</p>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-danger/10 flex items-center justify-center text-danger">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Overdue Invoices</p>
              <p className="text-2xl font-bold font-heading tabular-nums">{kpis.overdueCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "all" ? "/admin/invoices" : `/admin/invoices?status=${t.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${active === t.value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-body hover:bg-muted"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <InvoicesTable data={invoices} activeStatus={active} />
    </div>
  );
}
