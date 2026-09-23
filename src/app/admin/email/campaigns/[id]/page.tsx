import { notFound } from "next/navigation";
import { getEmailCampaignById, getEmailTemplates } from "@/lib/data/email-campaigns";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailCampaignForm } from "@/components/admin/email-campaign-form";

export const metadata = {
  title: "Edit Email Campaign | AutoHauz Admin",
};

export default async function EditEmailCampaignPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminRole(["admin", "owner", "content"]);
  const params = await props.params;

  const campaign = await getEmailCampaignById(params.id);
  const templates = await getEmailTemplates();
  
  if (!campaign) {
    notFound();
  }

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">Edit Campaign</h1>
        <p className="text-muted-foreground mt-1">Make changes or send your campaign.</p>
      </div>

      <EmailCampaignForm campaign={campaign} templates={templates} />
    </Container>
  );
}
