import { format } from "date-fns";
import { Plus } from "lucide-react";
import { getEmailCampaigns } from "@/lib/data/email-campaigns";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS } from "@/lib/email/status";

export const metadata = { title: "Email campaigns" };

export default async function EmailCampaignsPage() {
  await requirePermission("email.view");
  const campaigns = await getEmailCampaigns();

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-foreground">Email campaigns</h1>
          <p className="mt-1 text-muted-foreground">Send marketing emails to subscribers who have confirmed their consent.</p>
        </div>
        <ButtonLink href="/admin/email/campaigns/new">
          <Plus className="mr-2 size-4" aria-hidden="true" /> New campaign
        </ButtonLink>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Email campaigns</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Campaign</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Delivered</th>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No campaigns yet. Create a template first, then a campaign that uses it.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <a href={`/admin/email/campaigns/${c.id}`} className="font-medium text-foreground hover:underline">
                        {c.name}
                      </a>
                      <div className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">{c.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={CAMPAIGN_STATUS[c.status].variant}>{CAMPAIGN_STATUS[c.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {c.status === "sent" || c.status === "sending" ? `${c.sentCount} of ${c.recipientsCount}` : "—"}
                      {c.unsubscribedCount > 0 ? <span className="block text-xs">{c.unsubscribedCount} unsubscribed</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.sentAt
                        ? `Sent ${format(new Date(c.sentAt), "d MMM yyyy, h:mm a")}`
                        : c.scheduledAt && c.status === "scheduled"
                          ? `Scheduled ${format(new Date(c.scheduledAt), "d MMM yyyy, h:mm a")}`
                          : `Created ${format(new Date(c.createdAt), "d MMM yyyy")}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
}
