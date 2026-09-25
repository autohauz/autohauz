import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/security/auth";
import { Container } from "@/components/ui/container";
import { EmailTemplateBuilder } from "@/components/admin/email-template-builder";
import { getEmailTemplateById, getEmailVehicleOptions } from "@/lib/data/email-campaigns";
import { getEmailSender, resolveEmailVehicles } from "@/lib/email/marketing";
import { referencedVehicleIds } from "@/lib/email/blocks";

export const metadata = { title: "Edit email template" };

export default async function EditEmailTemplatePage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("email.write");
  const { id } = await props.params;
  const template = await getEmailTemplateById(id);
  if (!template) notFound();

  const [sender, vehicleOptions, previewVehicles] = await Promise.all([
    getEmailSender(),
    getEmailVehicleOptions(),
    resolveEmailVehicles(referencedVehicleIds(template.blocks ?? [])),
  ]);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">Edit email template</h1>
        {template.blocks === null ? (
          <p role="note" className="mt-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
            This template was created with raw HTML, which can&apos;t be sent safely. Rebuild its content with blocks below; the old HTML is not used.
          </p>
        ) : (
          <p className="mt-1 text-muted-foreground">Changes apply to campaigns that haven&apos;t been sent yet.</p>
        )}
      </div>
      <EmailTemplateBuilder
        template={{ id: template.id, name: template.name, subject: template.subject, previewText: template.previewText, blocks: template.blocks }}
        sender={sender}
        vehicleOptions={vehicleOptions}
        previewVehicles={previewVehicles}
      />
    </Container>
  );
}
