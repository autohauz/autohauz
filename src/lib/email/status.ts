import type { EmailCampaign } from "@/lib/domain";

export const CAMPAIGN_STATUS: Record<EmailCampaign["status"], { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "neutral" },
  scheduled: { label: "Scheduled", variant: "info" },
  sending: { label: "Sending", variant: "warning" },
  sent: { label: "Sent", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  failed: { label: "Failed", variant: "danger" },
};
