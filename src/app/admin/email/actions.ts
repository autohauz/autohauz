"use server";

import { updateTags } from "@/lib/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/security/auth";
import { MarketingEmailService } from "@/lib/email/marketing";

// --- Templates ---
export async function createEmailTemplate(formData: FormData) {
  const user = await requireAdminRole(["admin", "owner", "content"]);
  const supabase = createAdminClient();

  const name = formData.get("name")?.toString().trim();
  const subject = formData.get("subject")?.toString().trim();
  const htmlBody = formData.get("htmlBody")?.toString().trim();
  const textBody = formData.get("textBody")?.toString().trim() || null;
  const previewText = formData.get("previewText")?.toString().trim() || null;

  if (!name || !subject || !htmlBody) return { error: "Name, subject, and HTML body are required." };

  const { data, error } = await supabase.from("email_templates").insert({
    name, subject, html_body: htmlBody, text_body: textBody, preview_text: previewText, created_by: user.id
  }).select("id").single();

  if (error) return { error: error.message };
  updateTags("email_templates");
  redirect(`/admin/email/templates/\${data.id}`);
}

export async function updateEmailTemplate(id: string, formData: FormData) {
  await requireAdminRole(["admin", "owner", "content"]);
  const supabase = createAdminClient();

  const name = formData.get("name")?.toString().trim();
  const subject = formData.get("subject")?.toString().trim();
  const htmlBody = formData.get("htmlBody")?.toString().trim();
  const textBody = formData.get("textBody")?.toString().trim() || null;
  const previewText = formData.get("previewText")?.toString().trim() || null;

  if (!name || !subject || !htmlBody) return { error: "Name, subject, and HTML body are required." };

  const { error } = await supabase.from("email_templates").update({
    name, subject, html_body: htmlBody, text_body: textBody, preview_text: previewText, updated_at: new Date().toISOString()
  }).eq("id", id);

  if (error) return { error: error.message };
  updateTags("email_templates");
  return { success: true };
}

// --- Campaigns ---
export async function createEmailCampaign(formData: FormData) {
  const user = await requireAdminRole(["admin", "owner", "content"]);
  const supabase = createAdminClient();

  const name = formData.get("name")?.toString().trim();
  const subject = formData.get("subject")?.toString().trim();
  const templateId = formData.get("templateId")?.toString().trim();
  
  if (!name || !subject || !templateId) return { error: "Name, subject, and template are required." };

  const { data, error } = await supabase.from("email_campaigns").insert({
    name, subject, template_id: templateId, created_by: user.id, status: "draft"
  }).select("id").single();

  if (error) return { error: error.message };
  updateTags("email_campaigns");
  redirect(`/admin/email/campaigns/\${data.id}`);
}

export async function updateEmailCampaign(id: string, formData: FormData) {
  await requireAdminRole(["admin", "owner", "content"]);
  const supabase = createAdminClient();

  const name = formData.get("name")?.toString().trim();
  const subject = formData.get("subject")?.toString().trim();
  const templateId = formData.get("templateId")?.toString().trim() || null;
  const status = formData.get("status")?.toString().trim() || "draft";

  const { error } = await supabase.from("email_campaigns").update({
    name, subject, template_id: templateId, status, updated_at: new Date().toISOString()
  }).eq("id", id);

  if (error) return { error: error.message };
  updateTags("email_campaigns");
  return { success: true };
}

export async function sendEmailCampaign(id: string) {
  await requireAdminRole(["admin", "owner"]);
  // Mark as scheduled/sending, then fire background task
  const supabase = createAdminClient();
  const { error } = await supabase.from("email_campaigns").update({
    status: "sending"
  }).eq("id", id);

  if (error) return { error: error.message };
  updateTags("email_campaigns");

  // Fire async processor (in NextJS server action context this is tricky to keep alive,
  // but since MarketingEmailService catches all, it will try to run as long as lambda stays up,
  // or it needs a queue. For this implementation, we await it or start it asynchronously.)
  
  // Start async (fire and forget)
  MarketingEmailService.processCampaign(id).catch(console.error);

  return { success: true };
}
