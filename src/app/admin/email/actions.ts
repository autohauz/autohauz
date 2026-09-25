"use server";

import { z } from "zod";
import { updateTags } from "@/lib/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/security/auth";
import { emailBlocksSchema, renderEmailHtml, renderEmailText } from "@/lib/email/blocks";
import { getEmailSender, loadCampaignContent, processCampaignBatch, sendTestEmail } from "@/lib/email/marketing";
import { transporter } from "@/lib/email/ses";

export type EmailActionResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

type Supabase = ReturnType<typeof createAdminClient>;

const UUID = z.string().uuid();
const EMAIL = z.string().trim().toLowerCase().email().max(254);

function fail(context: string, error: { code?: string; message: string }): EmailActionResult {
  if (error.code === "55000" || error.code === "P0002") return { ok: false, error: error.message };
  if (error.code === "23505") return { ok: false, error: "That already exists." };
  console.error(`[email] ${context}:`, error.message);
  return { ok: false, error: `Could not ${context}. Please try again.` };
}

async function audit(supabase: Supabase, actorId: string, action: string, entityType: string, id: string | null, diff: Record<string, unknown> = {}) {
  const { error } = await supabase.from("activity_logs").insert({ user_id: actorId, action, entity_type: entityType, entity_id: id, diff });
  if (error) console.error(`[email] audit "${action}" failed:`, error.message);
}

// ─── Templates ───────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  previewText: z.string().trim().max(150).optional().transform((v) => v || null),
  blocks: emailBlocksSchema,
});

export async function saveEmailTemplate(id: string | null, input: z.input<typeof templateSchema>): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (id && !UUID.safeParse(id).success) return { ok: false, error: "Template not found" };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template" };
  const d = parsed.data;

  // html_body / text_body keep a rendered reference copy (legacy NOT NULL
  // columns); every real send re-renders from `blocks` per recipient.
  const sender = await getEmailSender();
  const ctx = { sender, vehicles: {}, firstName: null, unsubscribeUrl: `${sender.siteUrl}/newsletter/unsubscribe`, preheader: d.previewText };
  const row = {
    name: d.name,
    subject: d.subject,
    preview_text: d.previewText,
    blocks: d.blocks,
    html_body: renderEmailHtml(d.blocks, ctx, d.subject),
    text_body: renderEmailText(d.blocks, ctx),
  };

  const supabase = createAdminClient();
  if (id) {
    const { error } = await supabase.from("email_templates").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail("save the template", error);
    updateTags("email_templates");
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("email_templates").insert({ ...row, created_by: user.id }).select("id").single();
  if (error || !data) return fail("create the template", error ?? { message: "no row" });
  updateTags("email_templates");
  return { ok: true, id: data.id };
}

export async function sendTemplateTest(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Template not found" };
  if (!transporter) return { ok: false, error: "Email sending is not configured (SMTP settings missing)." };
  if (!user.email) return { ok: false, error: "Your account has no email address." };

  const { data } = await createAdminClient().from("email_templates").select("subject, preview_text, blocks").eq("id", id).maybeSingle();
  const blocks = emailBlocksSchema.safeParse(data?.blocks);
  if (!data || !blocks.success) return { ok: false, error: "Save the template with at least one block first." };

  const res = await sendTestEmail({ subject: data.subject, previewText: data.preview_text, blocks: blocks.data }, user.email, user.id);
  return res.ok ? { ok: true, message: `Test sent to ${user.email}` } : { ok: false, error: "The test email could not be sent." };
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

const campaignSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  previewText: z.string().trim().max(150).optional().transform((v) => v || null),
  templateId: UUID,
  segmentId: UUID.optional().or(z.literal("")).transform((v) => v || null),
});

export async function saveEmailCampaign(id: string | null, input: z.input<typeof campaignSchema>): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (id && !UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign" };
  const d = parsed.data;
  const row = { name: d.name, subject: d.subject, preview_text: d.previewText, template_id: d.templateId, segment_id: d.segmentId };

  const supabase = createAdminClient();
  if (id) {
    // Only editable before sending starts.
    const { data, error } = await supabase
      .from("email_campaigns")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["draft", "scheduled"])
      .select("id");
    if (error) return fail("save the campaign", error);
    if (!data?.length) return { ok: false, error: "Only draft or scheduled campaigns can be edited." };
    updateTags("email_campaigns");
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("email_campaigns").insert({ ...row, status: "draft", created_by: user.id }).select("id").single();
  if (error || !data) return fail("create the campaign", error ?? { message: "no row" });
  updateTags("email_campaigns");
  return { ok: true, id: data.id };
}

/** Pre-send checks that make a campaign compliant and deliverable. */
async function sendReadiness(campaignId: string): Promise<string | null> {
  if (!transporter) return "Email sending is not configured (SMTP settings missing).";
  const sender = await getEmailSender();
  if (!sender.name || !(sender.email || sender.phone)) {
    return "Add the business name and a contact email or phone in Settings: marketing emails must identify the sender and how to contact them.";
  }
  const content = await loadCampaignContent(campaignId);
  if ("error" in content) return content.error;
  return null;
}

export async function scheduleEmailCampaign(id: string, scheduledAt: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.send");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 5 * 60_000) {
    return { ok: false, error: "Choose a time at least 5 minutes from now." };
  }
  const problem = await sendReadiness(id);
  if (problem) return { ok: false, error: problem };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .update({ status: "scheduled", scheduled_at: when.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select("id");
  if (error) return fail("schedule the campaign", error);
  if (!data?.length) return { ok: false, error: "Only draft campaigns can be scheduled." };
  await audit(supabase, user.id, "email_campaign_scheduled", "email_campaign", id, { scheduledAt: when.toISOString() });
  updateTags("email_campaigns");
  return { ok: true, message: "Campaign scheduled" };
}

export async function unscheduleEmailCampaign(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.send");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .update({ status: "draft", scheduled_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id");
  if (error) return fail("unschedule the campaign", error);
  if (!data?.length) return { ok: false, error: "This campaign is not scheduled." };
  await audit(supabase, user.id, "email_campaign_unscheduled", "email_campaign", id);
  updateTags("email_campaigns");
  return { ok: true, message: "Back to draft" };
}

/**
 * Starts sending now. start_email_campaign() is atomic and conditional
 * (draft/scheduled → sending) and snapshots recipients into the queue, so a
 * double click cannot send twice. The first batch goes out immediately;
 * larger lists continue from the campaign page and the cron job.
 */
export async function sendEmailCampaignNow(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.send");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const problem = await sendReadiness(id);
  if (problem) return { ok: false, error: problem };

  const supabase = createAdminClient();
  const { data: recipients, error } = await supabase.rpc("start_email_campaign", { p_campaign_id: id });
  if (error) return fail("start the campaign", error);
  await audit(supabase, user.id, "email_campaign_sent", "email_campaign", id, { recipients });

  const batch = await processCampaignBatch(id);
  updateTags("email_campaigns");
  if (batch.error) return { ok: false, error: batch.error };
  return {
    ok: true,
    message: batch.done
      ? `Sent to ${batch.sent} recipient${batch.sent === 1 ? "" : "s"}${batch.failed ? ` (${batch.failed} failed)` : ""}.`
      : `Sending to ${recipients} recipients — ${batch.sent} sent so far.`,
  };
}

/** Sends the next batch of a campaign that is mid-send (drives large lists from the browser). */
export async function continueEmailCampaign(id: string): Promise<EmailActionResult & { done?: boolean }> {
  await requirePermission("email.send");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const batch = await processCampaignBatch(id);
  updateTags("email_campaigns");
  if (batch.error) return { ok: false, error: batch.error };
  return { ok: true, done: batch.done, message: `${batch.sent} sent${batch.failed ? `, ${batch.failed} failed` : ""}` };
}

/** Re-queues failed recipients (still consented and not suppressed) for another attempt. */
export async function retryFailedSends(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.send");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaign_sends")
    .update({ status: "pending", error: null, attempts: 0, claimed_at: null })
    .eq("campaign_id", id)
    .eq("status", "failed")
    .select("id");
  if (error) return fail("retry failed sends", error);
  if (!data?.length) return { ok: false, error: "No failed sends to retry." };
  await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", id).eq("status", "sent");
  await audit(supabase, user.id, "email_campaign_retry", "email_campaign", id, { count: data.length });
  const batch = await processCampaignBatch(id);
  updateTags("email_campaigns");
  return { ok: true, message: `Retrying ${data.length} — ${batch.sent} sent so far.` };
}

export async function cancelEmailCampaign(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select("id");
  if (error) return fail("cancel the campaign", error);
  if (!data?.length) return { ok: false, error: "Only draft or scheduled campaigns can be cancelled." };
  await audit(supabase, user.id, "email_campaign_cancelled", "email_campaign", id);
  updateTags("email_campaigns");
  return { ok: true, message: "Campaign cancelled" };
}

export async function sendCampaignTest(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Campaign not found" };
  if (!transporter) return { ok: false, error: "Email sending is not configured (SMTP settings missing)." };
  if (!user.email) return { ok: false, error: "Your account has no email address." };
  const content = await loadCampaignContent(id);
  if ("error" in content) return { ok: false, error: content.error };
  const res = await sendTestEmail(content, user.email, user.id);
  return res.ok ? { ok: true, message: `Test sent to ${user.email}` } : { ok: false, error: "The test email could not be sent." };
}

// ─── Contacts ────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  email: EMAIL,
  firstName: z.string().trim().max(80).optional().transform((v) => v || null),
  lastName: z.string().trim().max(80).optional().transform((v) => v || null),
  tags: z
    .string()
    .max(500)
    .optional()
    .transform((v) => [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
  consentNote: z.string().trim().min(5, "Record how and when this person consented").max(300),
  consentConfirmed: z.boolean().refine((v) => v, { message: "Confirm that this person agreed to receive marketing email" }),
});

/**
 * Adds a contact who consented outside the website (e.g. ticked a box on a
 * paper form at the yard). Staff must record how consent was given. People
 * who unsubscribed or are suppressed cannot be re-added by staff — only by
 * re-subscribing themselves through the confirmation link.
 */
export async function addEmailContact(input: z.input<typeof contactSchema>): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid contact" };
  const d = parsed.data;
  const supabase = createAdminClient();

  const [{ data: suppressed }, { data: existing }] = await Promise.all([
    supabase.from("email_suppressions").select("reason").eq("email", d.email).maybeSingle(),
    supabase.from("email_contacts").select("id, subscription_status").eq("email", d.email).maybeSingle(),
  ]);
  if (suppressed || (existing && existing.subscription_status !== "pending")) {
    return {
      ok: false,
      error:
        existing?.subscription_status === "subscribed"
          ? "This address is already subscribed."
          : "This address has unsubscribed or cannot receive email. They can only re-subscribe themselves from the website.",
    };
  }

  const row = {
    email: d.email,
    first_name: d.firstName,
    last_name: d.lastName,
    tags: d.tags,
    source: "manual",
    subscription_status: "subscribed",
    consent_given: true,
    consent_at: new Date().toISOString(),
    consent_source: `manual: ${d.consentNote}`,
  };
  const { data, error } = existing
    ? await supabase.from("email_contacts").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("email_contacts").insert(row).select("id").single();
  if (error || !data) return fail("add the contact", error ?? { message: "no row" });

  await audit(supabase, user.id, "email_contact_added", "email_contact", data.id, { consentNote: d.consentNote });
  updateTags("email_contacts");
  return { ok: true, id: data.id, message: "Contact added" };
}

export async function unsubscribeEmailContact(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Contact not found" };
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("unsubscribe_email_contact", { p_contact_id: id, p_campaign_id: null });
  if (error) return fail("unsubscribe the contact", error);
  if (!data) return { ok: false, error: "Contact not found" };
  await audit(supabase, user.id, "email_contact_unsubscribed", "email_contact", id);
  updateTags("email_contacts");
  return { ok: true, message: "Unsubscribed" };
}

// ─── Segments ────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  tags: z
    .string()
    .max(500)
    .optional()
    .transform((v) => [...new Set((v ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20)),
  source: z.string().trim().max(80).optional().transform((v) => v || null),
});

export async function createEmailSegment(input: z.input<typeof segmentSchema>): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  const parsed = segmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid segment" };
  const { name, description, tags, source } = parsed.data;
  const filters: Record<string, unknown> = {};
  if (tags.length) filters.tags = tags;
  if (source) filters.source = source;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("email_segments").insert({ name, description, filters }).select("id").single();
  if (error || !data) return fail("create the segment", error ?? { message: "no row" });
  await audit(supabase, user.id, "email_segment_created", "email_segment", data.id, filters);
  updateTags("email_segments");
  return { ok: true, id: data.id, message: "Segment created" };
}

export async function deleteEmailSegment(id: string): Promise<EmailActionResult> {
  const user = await requirePermission("email.write");
  if (!UUID.safeParse(id).success) return { ok: false, error: "Segment not found" };
  const supabase = createAdminClient();
  const { error } = await supabase.from("email_segments").delete().eq("id", id);
  if (error) return fail("delete the segment", error);
  await audit(supabase, user.id, "email_segment_deleted", "email_segment", id);
  updateTags("email_segments", "email_campaigns");
  return { ok: true, message: "Segment deleted" };
}
