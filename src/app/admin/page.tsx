import Link from "next/link";
import { Inbox, Car, AlertTriangle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { getAdminDashboardMetrics } from "@/lib/data/dashboard";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();

  const leads = metrics?.leads;
  const inv = metrics?.inventory;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your inventory and leads at a glance.</p>
      </header>

      {!metrics ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          Could not load metrics. Check your session and try again.
        </div>
      ) : (
        <>
          {/* Lead KPIs */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Leads</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Kpi label="Awaiting first contact" value={leads?.awaiting_first_contact ?? 0} icon={Inbox} tone={leads && leads.awaiting_first_contact > 0 ? "primary" : "muted"} href="/admin/leads?status=new" />
              <Kpi label="SLA breaches" value={leads?.sla_breaches ?? 0} icon={AlertTriangle} tone={leads && leads.sla_breaches > 0 ? "danger" : "muted"} href="/admin/leads?status=new" />
              <Kpi label="Won" value={leads?.won ?? 0} icon={CheckCircle2} tone="success" />
              <Kpi label="Total leads" value={leads?.total ?? 0} icon={Inbox} tone="muted" href="/admin/leads" />
            </div>
          </section>

          {/* Inventory KPIs */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inventory</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Kpi label="Available" value={inv?.available ?? 0} icon={Car} tone="success" href="/admin/inventory?status=available" />
              <Kpi label="Reserved" value={inv?.reserved ?? 0} icon={Clock} tone="warning" href="/admin/inventory?status=reserved" />
              <Kpi label="Draft" value={inv?.draft ?? 0} icon={Car} tone="muted" href="/admin/inventory?status=draft" />
              <Kpi label="Sold" value={inv?.sold ?? 0} icon={CheckCircle2} tone="muted" href="/admin/inventory?status=sold" />
            </div>
          </section>

          {/* Invoice Quick Link (KPIs handled in the invoice dashboard) */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Invoicing</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <QuickAction href="/admin/invoices/new" title="Create Invoice" body="Draft a new invoice." />
              <QuickAction href="/admin/invoices" title="View Invoices" body="Manage billing & payments." />
            </div>
          </section>

          {/* Quick actions */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QuickAction href="/admin/inventory/new" title="Add a vehicle" body="List a new car with photos and specs." />
            <QuickAction href="/admin/leads" title="Work your leads" body="Respond to new enquiries within 15 minutes." />
          </section>
        </>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  primary: "text-primary",
  danger: "text-danger",
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

function Kpi({
  label, value, icon: Icon, tone = "muted", href,
}: {
  label: string; value: number; icon: React.ElementType; tone?: string; href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${TONE[tone]}`} />
      </div>
      <p className={`mt-2 font-heading text-3xl font-extrabold tabular-nums ${tone === "muted" ? "text-foreground" : TONE[tone]}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block transition-shadow hover:shadow-md">{inner}</Link> : inner;
}

function QuickAction({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:shadow-md">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <ArrowRight className="size-5 text-primary" />
    </Link>
  );
}
