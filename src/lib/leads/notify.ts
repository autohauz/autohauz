import { transporter, FROM, REPLY_TO, emailShell, emailButton, escapeHtml } from "@/lib/email/ses";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, optionalEnv } from "@/lib/config";
import type { LeadType } from "@/lib/domain";

const TYPE_LABEL: Record<LeadType, string> = {
  vehicle_enquiry: "Vehicle enquiry",
  inspection: "Inspection request",
  finance: "Finance enquiry",
  trade_in: "Trade-in enquiry",
  sell: "Sell your car",
  callback: "Callback request",
  general: "General enquiry",
};

/** Staff addresses that receive lead alerts: `settings.notification_recipients`, falling back to CONTACT_EMAIL_TO. */
export async function notificationRecipients(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "notification_recipients").maybeSingle();
  const emails = (data?.value as { emails?: string[] } | null)?.emails;
  const list = Array.isArray(emails) ? emails.filter(Boolean) : [];
  const fallback = optionalEnv("CONTACT_EMAIL_TO");
  return list.length > 0 ? list : fallback ? [fallback] : [];
}

/**
 * Instant sales notification for a new lead (SRS §14.3). Best-effort: returns
 * `{ sent }` and never throws so a mail failure can't lose an already-persisted
 * lead. The route logs a 'notified' event on success.
 */
export async function notifyNewLead(input: {
  type: LeadType;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  vehicleTitle?: string | null;
  sourceUrl?: string | null;
}): Promise<{ sent: boolean }> {
  if (!transporter) return { sent: false };
  const to = await notificationRecipients();
  if (to.length === 0) return { sent: false };

  const label = TYPE_LABEL[input.type] ?? "New lead";
  const subject = input.vehicleTitle
    ? `New ${label.toLowerCase()}: ${input.vehicleTitle}`
    : `New ${label.toLowerCase()} from ${input.name}`;

  const lines = [
    `${label}`,
    ``,
    `Name:  ${input.name}`,
    `Phone: ${input.phone}`,
    input.email ? `Email: ${input.email}` : null,
    input.vehicleTitle ? `Vehicle: ${input.vehicleTitle}` : null,
    input.message ? `\nMessage:\n${input.message}` : null,
    input.sourceUrl ? `\nSource: ${input.sourceUrl}` : null,
    ``,
    `Respond within 15 minutes for the best conversion (SLA).`,
  ].filter(Boolean);

  const rows: Array<[string, string]> = [
    ["Name", input.name],
    ["Phone", input.phone],
    ...(input.email ? [["Email", input.email] as [string, string]] : []),
    ...(input.vehicleTitle ? [["Vehicle", input.vehicleTitle] as [string, string]] : []),
    ...(input.sourceUrl ? [["Source", input.sourceUrl] as [string, string]] : []),
  ];
  const html = emailShell({
    title: subject,
    preheader: `${label} from ${input.name}`,
    bodyHtml:
      `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6;">` +
      rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6b7686;">${escapeHtml(k)}</td><td style="padding:2px 0;">${escapeHtml(v)}</td></tr>`).join("") +
      `</table>` +
      (input.message ? `<p style="margin:16px 0 0;padding:12px 16px;background:#f4f6fa;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.message)}</p>` : "") +
      `<p style="margin:16px 0 0;font-size:13px;color:#6b7686;">Respond within 15 minutes for the best chance of conversion.</p>` +
      emailButton(`${getAppUrl()}/admin/leads?status=new`, "Open new leads"),
  });

  try {
    await transporter.sendMail({ from: FROM, replyTo: REPLY_TO, to, subject, text: lines.join("\n"), html });
    return { sent: true };
  } catch {
    return { sent: false };
  }
}
