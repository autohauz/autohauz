import { requireAdminRole } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailTemplateForm } from "@/components/admin/email-template-form";

export const metadata = {
  title: "New Email Template | AutoHauz Admin",
};

export default async function NewEmailTemplatePage() {
  await requireAdminRole(["admin", "owner", "content"]);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-extrabold text-foreground">New Email Template</h1>
        <p className="text-muted-foreground mt-1">Design a new marketing email layout.</p>
      </div>

      <EmailTemplateForm />
    </Container>
  );
}
