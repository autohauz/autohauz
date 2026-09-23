import { transporter, FROM, REPLY_TO, emailShell, escapeHtml } from "./ses";
import { getAppUrl } from "@/lib/config";
import type { EmailCampaign, EmailTemplate } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Marketing Email Service
 * 
 * Currently relies on the SMTP configuration used in ses.ts.
 * Abstracted to easily swap out for Resend/SendGrid when volume increases.
 */
export const MarketingEmailService = {
  
  /**
   * Sends a single campaign email to a subscriber.
   * Interpolates basic variables like {{firstName}} and appends unsubscribe link.
   */
  async sendCampaignEmail(
    contact: { id: string; email: string; firstName: string | null },
    campaign: EmailCampaign,
    template: EmailTemplate
  ) {
    if (!transporter) return { skipped: true };

    const unsubscribeUrl = `\${getAppUrl()}/newsletter/unsubscribe?t=\${contact.id}`;
    
    // Simple template interpolation
    let html = template.htmlBody
      .replace(/{{firstName}}/g, escapeHtml(contact.firstName || "there"))
      .replace(/{{unsubscribeUrl}}/g, escapeHtml(unsubscribeUrl));
    
    // Add unsubscribe footer if not present in template
    if (!html.includes(unsubscribeUrl)) {
      html += `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e6eaf0; font-size: 12px; color: #6b7686; text-align: center;">
          <p>You are receiving this email because you subscribed to our updates.</p>
          <p><a href="\${unsubscribeUrl}" style="color: #6b7686; text-decoration: underline;">Unsubscribe</a></p>
        </div>
      `;
    }

    // Wrap in standard shell if it doesn't look like a full HTML document
    if (!html.includes("<html")) {
      html = emailShell({
        title: campaign.subject,
        preheader: campaign.previewText || undefined,
        bodyHtml: html,
      });
    }

    let text = template.textBody || "";
    if (text) {
      text = text.replace(/{{firstName}}/g, contact.firstName || "there")
                 .replace(/{{unsubscribeUrl}}/g, unsubscribeUrl);
      if (!text.includes(unsubscribeUrl)) {
        text += `\n\nUnsubscribe: \${unsubscribeUrl}`;
      }
    }

    try {
      await transporter.sendMail({
        from: FROM,
        replyTo: REPLY_TO,
        to: contact.email,
        subject: campaign.subject,
        html,
        text: text || undefined,
        headers: {
          "List-Unsubscribe": `<\${unsubscribeUrl}>`,
        },
      });
      return { success: true };
    } catch (error: any) {
      console.error(`Failed to send to \${contact.email}`, error);
      return { error: error.message };
    }
  },

  /**
   * Processes a campaign send job. In a real large-scale app, this would queue jobs.
   * For this implementation, we run it async in the background for smaller lists.
   */
  async processCampaign(campaignId: string) {
    const supabase = createAdminClient();
    
    // 1. Fetch campaign & template
    const { data: campaign } = await supabase
      .from("email_campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaignId)
      .single();
      
    if (!campaign || campaign.status !== "scheduled" && campaign.status !== "sending") return;

    // 2. Fetch contacts (simplified: just fetching all subscribed for the segment)
    // In reality, segment filters would be applied here. For now, all 'subscribed'.
    const { data: contacts } = await supabase
      .from("email_contacts")
      .select("id, email, first_name")
      .eq("subscription_status", "subscribed");

    if (!contacts || contacts.length === 0) {
      await supabase.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaignId);
      return;
    }

    // 3. Mark as sending
    await supabase.from("email_campaigns").update({ 
      status: "sending",
      recipients_count: contacts.length 
    }).eq("id", campaignId);

    // 4. Send emails
    let sentCount = 0;
    let failedCount = 0;

    for (const contact of contacts) {
      const res = await this.sendCampaignEmail(
        { id: contact.id, email: contact.email, firstName: contact.first_name },
        campaign as any,
        campaign.email_templates as any
      );

      // Record send event
      await supabase.from("email_events").insert({
        campaign_id: campaignId,
        contact_id: contact.id,
        event_type: res.error ? "bounced" : "sent",
        metadata: res.error ? { error: res.error } : {}
      });

      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    // 5. Update campaign stats
    await supabase.from("email_campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      bounced_count: failedCount,
    }).eq("id", campaignId);
  }
};
