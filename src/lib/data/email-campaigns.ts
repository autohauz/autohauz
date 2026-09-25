import "server-only";
import { requirePermission } from "@/lib/security/auth";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailCampaign, EmailTemplate } from "@/lib/domain";
import { parseEmailBlocks } from "@/lib/email/blocks";

type TemplateRow = {
  id: string; name: string; subject: string; blocks: unknown; html_body: string; text_body: string | null;
  preview_text: string | null; created_by: string | null; created_at: string; updated_at: string;
};

type CampaignRow = {
  id: string; name: string; subject: string; preview_text: string | null; status: EmailCampaign["status"];
  template_id: string | null; segment_id: string | null; html_body: string | null; text_body: string | null;
  scheduled_at: string | null; sent_at: string | null; recipients_count: number; sent_count: number;
  delivered_count: number; opened_count: number; clicked_count: number; bounced_count: number;
  complained_count: number; unsubscribed_count: number; created_by: string | null; created_at: string; updated_at: string;
};

export function toEmailTemplate(t: TemplateRow): EmailTemplate {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    blocks: parseEmailBlocks(t.blocks),
    htmlBody: t.html_body,
    textBody: t.text_body,
    previewText: t.preview_text,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function toEmailCampaign(c: CampaignRow): EmailCampaign {
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    previewText: c.preview_text,
    status: c.status,
    templateId: c.template_id,
    segmentId: c.segment_id,
    htmlBody: c.html_body,
    textBody: c.text_body,
    scheduledAt: c.scheduled_at,
    sentAt: c.sent_at,
    recipientsCount: c.recipients_count,
    sentCount: c.sent_count,
    deliveredCount: c.delivered_count,
    openedCount: c.opened_count,
    clickedCount: c.clicked_count,
    bouncedCount: c.bounced_count,
    complainedCount: c.complained_count,
    unsubscribedCount: c.unsubscribed_count,
    createdBy: c.created_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

const cached_getEmailTemplates = unstable_cache(
  async (): Promise<EmailTemplate[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });
      
    return ((data ?? []) as TemplateRow[]).map(toEmailTemplate);
  },
  ["email_templates"],
  { revalidate: 60, tags: ["email_templates"] },
);

const cached_getEmailCampaigns = unstable_cache(
  async (
    options: {
      status?: EmailCampaign["status"];
      limit?: number;
    } = {},
  ): Promise<EmailCampaign[]> => {
    const supabase = createAdminClient();
    let query = supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (options.status) {
      query = query.eq("status", options.status);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data } = await query;
    
    return ((data ?? []) as CampaignRow[]).map(toEmailCampaign);
  },
  ["email_campaigns"],
  { tags: ["email_campaigns"] },
);

export const getEmailCampaignById = async (id: string): Promise<EmailCampaign | null> => {
  await requirePermission("email.view");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[email] campaign query failed:", error.message);
  if (!data) return null;

  return toEmailCampaign(data as CampaignRow);
};

/** Staff-only: authorization is checked outside the cache on every call. */
export async function getEmailTemplates(...args: Parameters<typeof cached_getEmailTemplates>) {
  await requirePermission("email.view");
  return cached_getEmailTemplates(...args);
}

/** Staff-only: authorization is checked outside the cache on every call. */
export async function getEmailCampaigns(...args: Parameters<typeof cached_getEmailCampaigns>) {
  await requirePermission("email.view");
  return cached_getEmailCampaigns(...args);
}

export async function getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
  await requirePermission("email.view");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from("email_templates").select("*").eq("id", id).maybeSingle();
  if (error) console.error("[email] template query failed:", error.message);
  return data ? toEmailTemplate(data as TemplateRow) : null;
}

export type CampaignDeliveryStats = { total: number; pending: number; sent: number; failed: number; unsubscribed: number };

/** Live delivery progress for a campaign, from its send queue. */
export async function getCampaignDeliveryStats(id: string): Promise<CampaignDeliveryStats> {
  await requirePermission("email.view");
  const { data, error } = await createAdminClient().from("email_campaign_sends").select("status").eq("campaign_id", id);
  if (error) console.error("[email] send stats query failed:", error.message);
  const stats: CampaignDeliveryStats = { total: 0, pending: 0, sent: 0, failed: 0, unsubscribed: 0 };
  for (const { status } of (data ?? []) as { status: string }[]) {
    stats.total++;
    if (status === "pending" || status === "processing") stats.pending++;
    else if (status === "failed") stats.failed++;
    else if (status === "unsubscribed") stats.unsubscribed++;
    else stats.sent++;
  }
  return stats;
}

/** Cars that can be featured in an email (currently for sale). */
export async function getEmailVehicleOptions(): Promise<{ id: string; label: string }[]> {
  await requirePermission("email.write");
  const { data, error } = await createAdminClient()
    .from("vehicles")
    .select("id, stock_id, year, variant, price, makes:make_id ( name ), models:model_id ( name )")
    .in("status", ["available", "reserved"])
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) console.error("[email] vehicle options query failed:", error.message);
  type Row = { id: string; stock_id: string; year: number; variant: string | null; price: number | string; makes: { name: string } | null; models: { name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((v) => ({
    id: v.id,
    label: `${v.stock_id} · ${[v.year, v.makes?.name, v.models?.name, v.variant].filter(Boolean).join(" ")}`,
  }));
}
