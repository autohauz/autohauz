import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/config";
import { env } from "@/lib/env";
import { site } from "@/config/site";

/** SMTP transport (AWS SES or any SMTP relay). `null` when SMTP env is unset — every send becomes a no-op. */
export const transporter = (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 465,
      secure: (env.SMTP_PORT ?? 465) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

/**
 * Sender identity. There is deliberately no fallback address: sending from an
 * unverified domain fails at the relay anyway, and a hard-coded fallback would
 * be some other business's inbox. Configure `EMAIL_FROM` (and optionally
 * `REPLY_TO_EMAIL`) in the environment.
 */
export const FROM = env.EMAIL_FROM ?? `${site.brandName} <no-reply@${new URL(site.domain).hostname}>`;
export const REPLY_TO = env.REPLY_TO_EMAIL ?? env.CONTACT_EMAIL_TO ?? undefined;

/** Escapes text for interpolation into the HTML shell. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Shared HTML shell for every branded email: logo, body, footer.
 * Inline styles only (email clients ignore stylesheets); brand navy from the logo.
 */
export function emailShell(input: { title: string; bodyHtml: string; preheader?: string }): string {
  const logo = `${getAppUrl()}${site.assets.logoPrimary.replace(".png", "-480.png")}`;
  return `<!doctype html>
<html lang="${site.locale}">
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2636;">
  ${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;text-align:center;">
          <img src="${logo}" alt="${escapeHtml(site.brandName)}" height="40" style="height:40px;width:auto;display:inline-block;" />
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b3573;">${escapeHtml(input.title)}</h1>
          ${input.bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #e6eaf0;font-size:12px;line-height:1.5;color:#6b7686;text-align:center;">
          ${escapeHtml(site.brandName)} · ${escapeHtml(site.country)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** A single primary button. */
export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:#0b3573;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">${escapeHtml(label)}</a>
  </p>`;
}

// ─── Staff welcome ─────────────────────────────────────────────────────────

/** Sent once when a staff member first signs in (there are no customer accounts). */
export async function sendWelcomeEmail(input: { to: string; name: string }) {
  if (!transporter) return { skipped: true };
  const adminUrl = `${getAppUrl()}/admin`;
  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to: input.to,
    subject: `Welcome to the ${site.brandName} admin panel`,
    text: [
      `Hi ${input.name || "there"},`,
      "",
      `Your ${site.brandName} staff account is ready. Sign in to manage inventory, respond to leads and issue invoices.`,
      "",
      adminUrl,
    ].join("\n"),
    html: emailShell({
      title: `Welcome, ${escapeHtml(input.name || "there")}`,
      preheader: `Your ${site.brandName} staff account is ready.`,
      bodyHtml: `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Your ${escapeHtml(site.brandName)} staff account is ready. Sign in to manage inventory, respond to leads and issue invoices.</p>${emailButton(adminUrl, "Open the admin panel")}`,
    }),
  });
  return { skipped: false };
}

// ─── Staff reminder digest ─────────────────────────────────────────────────

/**
 * Daily staff digest: leads still marked "new" past the response window, and
 * vehicles still in draft. Sent by the reminders cron to the configured
 * notification recipients.
 */
export async function sendStaffReminderEmail(input: {
  to: string[];
  staleNewLeads: number;
  draftVehicles: number;
  adminUrl: string;
}) {
  if (!transporter) return { skipped: true };
  if (input.to.length === 0) return { skipped: true };
  const lines = [
    input.staleNewLeads > 0
      ? `${input.staleNewLeads} lead(s) have been waiting more than 24 hours without contact.`
      : "No leads are overdue for first contact.",
    input.draftVehicles > 0
      ? `${input.draftVehicles} vehicle(s) are still in draft and not visible to buyers.`
      : "No vehicles are sitting in draft.",
  ];
  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to: input.to,
    subject: input.staleNewLeads > 0 ? `${input.staleNewLeads} lead(s) need a response` : "Daily inventory & leads reminder",
    text: ["Daily reminder", "", ...lines, "", `Open the admin panel: ${input.adminUrl}`].join("\n"),
    html: emailShell({
      title: "Daily reminder",
      bodyHtml: `<ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.7;">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>${emailButton(input.adminUrl, "Open the admin panel")}`,
    }),
  });
  return { skipped: false };
}
