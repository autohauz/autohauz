import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailCampaign, EmailTemplate } from "@/lib/domain";

type RawRow = Record<string, unknown>;

export const getEmailTemplates = unstable_cache(
  async (): Promise<EmailTemplate[]> => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });
      
    return ((data ?? []) as RawRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      htmlBody: t.html_body,
      textBody: t.text_body,
      previewText: t.preview_text,
      createdBy: t.created_by,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));
  },
  ["email_templates"],
  { revalidate: 60, tags: ["email_templates"] },
);

export const getEmailCampaigns = unstable_cache(
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
    
    return ((data ?? []) as RawRow[]).map((c) => ({
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
    }));
  },
  ["email_campaigns"],
  { tags: ["email_campaigns"] },
);

export const getEmailCampaignById = async (id: string): Promise<EmailCampaign | null> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const c = data as RawRow;
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
};
