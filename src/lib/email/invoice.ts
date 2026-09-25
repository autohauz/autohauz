import "server-only";
import { transporter, FROM, REPLY_TO, emailShell, escapeHtml } from "./ses";
import { site } from "@/config/site";
import type { Invoice } from "@/lib/domain";
import { formatAud } from "@/lib/invoices/document";

/**
 * Transactional email: sends an issued invoice PDF to the billing contact.
 * Not marketing — no consent/unsubscribe applies, and it is never sent to
 * anyone except the invoice's own billing address.
 */
export async function sendInvoiceEmail(input: {
  to: string;
  invoice: Invoice;
  pdfBuffer: Buffer;
}): Promise<{ skipped: true } | { skipped: false; ok: boolean }> {
  if (!transporter) return { skipped: true };

  const { invoice, to, pdfBuffer } = input;
  const number = invoice.invoiceNumber ?? "DRAFT";
  const seller = invoice.sellerSnapshot?.tradingName || invoice.sellerSnapshot?.legalName || site.brandName;
  const title = invoice.documentTitle ?? "Invoice";
  const total = formatAud(invoice.totalIncGstCents);
  const balance = formatAud(Math.max(0, invoice.totalIncGstCents - invoice.paymentsCents));

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(invoice.billingName)},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Please find attached ${escapeHtml(title.toLowerCase())} ${escapeHtml(number)} from ${escapeHtml(seller)}.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;border-radius:8px;margin:24px 0;font-size:15px;">
      <tr><td style="padding:16px 16px 8px;color:#5b6980;">Total</td><td align="right" style="padding:16px 16px 8px;font-weight:bold;">${total}</td></tr>
      <tr><td style="padding:8px 16px 16px;color:#5b6980;border-top:1px solid #e6eaf0;">Balance due</td><td align="right" style="padding:8px 16px 16px;font-weight:bold;color:#0b3573;border-top:1px solid #e6eaf0;">${balance}</td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">If you have any questions, just reply to this email.</p>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      replyTo: REPLY_TO,
      to,
      subject: `${title} ${number} from ${seller}`,
      html: emailShell({ title: `${title} ${number}`, preheader: `${title} ${number} — ${total}`, bodyHtml }),
      text: `Hi ${invoice.billingName},\n\nPlease find attached ${title.toLowerCase()} ${number} from ${seller}.\nTotal: ${total}\nBalance due: ${balance}\n`,
      attachments: [{ filename: `${number}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
    });
    return { skipped: false, ok: true };
  } catch (err) {
    console.error("[email] invoice send failed:", err instanceof Error ? err.message : err);
    return { skipped: false, ok: false };
  }
}
