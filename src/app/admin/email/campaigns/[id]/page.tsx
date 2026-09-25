import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/security/auth";
import { roleCan } from "@/lib/security/permissions";
import { Container } from "@/components/ui/container";
import { EmailCampaignEditor } from "@/components/admin/email-campaign-editor";
import { getCampaignDeliveryStats, getEmailCampaignById, getEmailTemplates } from "@/lib/data/email-campaigns";
import { getAudienceSizes, getEmailSegments } from "@/lib/data/email-contacts";
import { getEmailSender, resolveEmailVehicles } from "@/lib/email/marketing";
import { referencedVehicleIds } from "@/lib/email/blocks";

export const metadata = { title: "Email campaign" };
export const dynamic = "force-dynamic";

export default async function EditEmailCampaignPage(props: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("email.view");
  const { id } = await props.params;
  const campaign = await getEmailCampaignById(id);
  if (!campaign) notFound();

  const [templates, segments, sender, stats] = await Promise.all([
    getEmailTemplates(),
    getEmailSegments(),
    getEmailSender(),
    getCampaignDeliveryStats(id),
  ]);
  const [audience, previewVehicles] = await Promise.all([
    getAudienceSizes(segments),
    resolveEmailVehicles(referencedVehicleIds(templates.flatMap((t) => t.blocks ?? []))),
  ]);

  return (
    <Container>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold text-foreground">{campaign.name}</h1>
      </div>
      <EmailCampaignEditor
        campaign={campaign}
        templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, blocks: t.blocks }))}
        segments={segments.map((s) => ({ id: s.id, name: s.name }))}
        audience={audience}
        stats={stats}
        sender={sender}
        previewVehicles={previewVehicles}
        canSend={roleCan(user.staffRole, "email.send")}
      />
    </Container>
  );
}
