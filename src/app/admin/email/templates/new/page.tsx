import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailTemplateBuilder } from "@/components/admin/email-template-builder";
import { getEmailSender } from "@/lib/email/marketing";
import { getEmailVehicleOptions } from "@/lib/data/email-campaigns";

export const metadata = { title: "New email template" };

export default async function NewEmailTemplatePage() {
  await requirePermission("email.write");
  const [sender, vehicleOptions] = await Promise.all([getEmailSender(), getEmailVehicleOptions()]);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">New email template</h1>
        <p className="mt-1 text-muted-foreground">Build a marketing email from blocks. The preview updates as you type.</p>
      </div>
      <EmailTemplateBuilder sender={sender} vehicleOptions={vehicleOptions} previewVehicles={{}} />
    </Container>
  );
}
