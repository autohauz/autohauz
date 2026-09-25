import { requirePermission } from "@/lib/security/auth";
import { roleCan } from "@/lib/security/permissions";
import { Container } from "@/components/ui/container";
import { EmailCampaignEditor } from "@/components/admin/email-campaign-editor";
import { getEmailTemplates } from "@/lib/data/email-campaigns";
import { getAudienceSizes, getEmailSegments } from "@/lib/data/email-contacts";
import { getEmailSender, resolveEmailVehicles } from "@/lib/email/marketing";
import { referencedVehicleIds } from "@/lib/email/blocks";

export const metadata = { title: "New email campaign" };

export default async function NewEmailCampaignPage() {
  const user = await requirePermission("email.write");
  const [templates, segments, sender] = await Promise.all([getEmailTemplates(), getEmailSegments(), getEmailSender()]);
  const [audience, previewVehicles] = await Promise.all([
    getAudienceSizes(segments),
    resolveEmailVehicles(referencedVehicleIds(templates.flatMap((t) => t.blocks ?? []))),
  ]);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">New campaign</h1>
        <p className="mt-1 text-muted-foreground">Pick a template and an audience. You can send a test before sending for real.</p>
      </div>
      <EmailCampaignEditor
        templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, blocks: t.blocks }))}
        segments={segments.map((s) => ({ id: s.id, name: s.name }))}
        audience={audience}
        stats={null}
        sender={sender}
        previewVehicles={previewVehicles}
        canSend={roleCan(user.staffRole, "email.send")}
      />
    </Container>
  );
}
