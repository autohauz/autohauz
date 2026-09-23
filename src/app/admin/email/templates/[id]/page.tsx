import { notFound } from "next/navigation";
import { getEmailCampaignById, getEmailTemplates } from "@/lib/data/email-campaigns";
import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailTemplateForm } from "@/components/admin/email-template-form";

export const metadata = {
  title: "Edit Email Template | AutoHauz Admin",
};

export default async function EditEmailTemplatePage(props: { params: Promise<{ id: string }> }) {
  await requireAdminRole(["admin", "owner", "content"]);
  const params = await props.params;

  const templates = await getEmailTemplates();
  const template = templates.find((t) => t.id === params.id);
  
  if (!template) {
    notFound();
  }

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">Edit Email Template</h1>
        <p className="text-muted-foreground mt-1">Make changes to the HTML layout.</p>
      </div>

      <EmailTemplateForm template={template} />
    </Container>
  );
}
