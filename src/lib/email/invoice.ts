import { transporter, FROM, REPLY_TO, emailShell, escapeHtml } from "./ses";
import { site } from "@/config/site";
import type { Invoice } from "@/lib/domain";

export async function sendInvoiceEmail(input: {
  to: string;
  invoice: Invoice;
  pdfBuffer: Buffer;
}) {
  if (!transporter) return { skipped: true };

  const { invoice, to, pdfBuffer } = input;
  const invNumber = invoice.invoiceNumber || "DRAFT";
  
  const formattedTotal = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.totalIncGstCents / 100);
  const formattedDue = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    Math.max(0, invoice.totalIncGstCents - invoice.paymentsCents) / 100
  );

  const subject = `Invoice ${invNumber} from ${site.brandName}`;
  const title = `Invoice ${invNumber}`;
  
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(invoice.billingName)},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Please find attached your invoice from ${escapeHtml(site.brandName)}.</p>
    <div style="background:#f4f6fa;border-radius:8px;padding:16px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;">
        <tr>
          <td style="color:#6b7686;padding-bottom:8px;">Total Amount:</td>
          <td align="right" style="font-weight:bold;padding-bottom:8px;">${formattedTotal}</td>
        </tr>
        <tr>
          <td style="color:#6b7686;padding-bottom:8px;">Amount Paid:</td>
          <td align="right" style="color:#22c55e;padding-bottom:8px;">-${new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.paymentsCents / 100)}</td>
        </tr>
        <tr>
          <td style="color:#6b7686;font-weight:bold;border-top:1px solid #e6eaf0;padding-top:8px;">Balance Due:</td>
          <td align="right" style="font-weight:bold;border-top:1px solid #e6eaf0;padding-top:8px;color:#0b3573;">${formattedDue}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">If you have any questions, please reply to this email.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    replyTo: REPLY_TO,
    to,
    subject,
    html: emailShell({
      title,
      preheader: `Invoice ${invNumber} for ${formattedTotal}`,
      bodyHtml,
    }),
    attachments: [
      {
        filename: `Invoice-${invNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { skipped: false };
}
