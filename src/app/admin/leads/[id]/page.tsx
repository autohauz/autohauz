import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Phone, MessageCircle, Mail } from "lucide-react";
import { getLeadDetail } from "@/lib/data/leads";
import { LeadActions } from "../lead-actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_STYLES, LEAD_TYPE_LABELS } from "@/lib/leads/status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { requirePermission } from "@/lib/security/auth";
import { formatPhoneForDisplay, telHref } from "@/lib/phone";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  created: "Lead created",
  status_changed: "Status changed",
  note: "Note added",
  assigned: "Assigned",
  notified: "Sales notified",
  reminder_set: "Reminder set",
  exported: "Exported",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("leads.view");
  const { id } = await params;
  const data = await getLeadDetail(id);
  if (!data) notFound();
  const { lead, events } = data;

  const payloadEntries = Object.entries(lead.payload ?? {}).filter(([, v]) => v !== null && v !== "");

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to leads</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">{LEAD_TYPE_LABELS[lead.type]} · {format(new Date(lead.createdAt), "d MMM yyyy, h:mma")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${LEAD_STATUS_STYLES[lead.status]}`}>{LEAD_STATUS_LABELS[lead.status]}</span>
      </div>

      {/* Quick contact */}
      <div className="flex flex-wrap gap-2">
        <a href={telHref(lead.phone)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"><Phone className="size-4" aria-hidden="true" />{formatPhoneForDisplay(lead.phone)}</a>
        <a href={buildWhatsAppUrl(lead.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><MessageCircle className="size-4" />WhatsApp</a>
        {lead.email ? <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"><Mail className="size-4" />{lead.email}</a> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {lead.message ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Message</h2>
              <p className="whitespace-pre-line text-sm text-body">{lead.message}</p>
            </section>
          ) : null}

          {payloadEntries.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Details</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {payloadEntries.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs capitalize text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
                    <dd className="text-foreground">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {lead.sourceUrl ? (
            <section className="rounded-xl border border-border bg-card p-5 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Attribution</h2>
              <p className="text-muted-foreground">Source: <span className="text-body">{lead.sourceUrl}</span></p>
              {lead.device ? <p className="text-muted-foreground">Device: <span className="text-body capitalize">{lead.device}</span></p> : null}
            </section>
          ) : null}

          {/* Timeline */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Timeline</h2>
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 flex-none rounded-full bg-primary" />
                  <div>
                    <p className="text-foreground">
                      {EVENT_LABELS[e.event] ?? e.event}
                      {e.event === "status_changed" && e.data?.status ? `: ${String(e.data.status)}` : ""}
                    </p>
                    {e.event === "note" && e.data?.note ? <p className="text-body">{String(e.data.note)}</p> : null}
                    <p className="text-xs text-muted-foreground">{format(new Date(e.createdAt), "d MMM, h:mma")}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div><LeadActions leadId={lead.id} status={lead.status} /></div>
      </div>
    </div>
  );
}
