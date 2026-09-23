import { getEmailTemplates } from "@/lib/data/email-campaigns";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailCampaignForm } from "@/components/admin/email-campaign-form";

export const metadata = {
  title: "New Email Campaign | AutoHauz Admin",
};

export default async function NewEmailCampaignPage() {
  await requireAdminRole(["admin", "owner", "content"]);
  const templates = await getEmailTemplates();

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">New Campaign</h1>
        <p className="text-muted-foreground mt-1">Draft a new email broadcast to your subscribers.</p>
      </div>

      <EmailCampaignForm templates={templates} />
    </Container>
  );
}
