import { getEmailCampaigns } from "@/lib/data/email-campaigns";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { format } from "date-fns";
import { Plus, Edit, Send } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Email Campaigns | AutoHauz Admin",
};

export default async function EmailCampaignsPage() {
  await requireAdminRole(["admin", "owner", "content", "sales"]);
  const campaigns = await getEmailCampaigns();

  return (
    <Container>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-foreground">Email Campaigns</h1>
          <p className="text-muted-foreground mt-1">Send marketing emails and track performance.</p>
        </div>
        <ButtonLink href="/admin/email/campaigns/new">
            <Plus className="size-4 mr-2" /> New Campaign
          </ButtonLink>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sent / Bounced</th>
                <th className="px-4 py-3 font-medium">Created / Sent Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No campaigns found. Create your first campaign!
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {campaign.name}
                      <div className="text-xs font-normal text-muted-foreground mt-0.5 truncate max-w-[200px]">
                        {campaign.subject}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full \${
                        campaign.status === "sent" ? "bg-success/10 text-success" : 
                        campaign.status === "sending" ? "bg-primary/10 text-primary animate-pulse" :
                        campaign.status === "draft" ? "bg-muted text-muted-foreground" :
                        "bg-warning/10 text-warning"
                      }`}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {campaign.status === "sent" || campaign.status === "sending" ? (
                        <span>
                          <span className="text-foreground font-medium">{campaign.sentCount}</span> sent / <span className="text-danger">{campaign.bouncedCount}</span> fail
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {campaign.sentAt 
                        ? <>Sent: {format(new Date(campaign.sentAt), "MMM d, yyyy HH:mm")}</>
                        : <>Created: {format(new Date(campaign.createdAt), "MMM d, yyyy")}</>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ButtonLink href={`/admin/email/campaigns/\${campaign.id}`} variant="ghost" size="sm"  >
                          <Edit className="size-4" />
                        </ButtonLink>
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
