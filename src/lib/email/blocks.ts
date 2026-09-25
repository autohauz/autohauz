import { z } from "zod";

/**
 * Email template blocks → email-safe HTML.
 *
 * Output is table-based, 600px, inline-styled (no <style>, no flex/grid, no
 * web fonts) because Outlook and Gmail strip or ignore most modern CSS. Every
 * piece of text is escaped; links must be https (or site-relative, made
 * absolute); images must be https.
 *
 * The header (brand) and the compliance footer (sender identity, contact
 * details, why you are receiving this, unsubscribe) are NOT blocks: they are
 * always rendered around the content, so no template can drop the
 * unsubscribe link or sender identification the Spam Act 2003 requires.
 *
 * Pure module: used by the server when sending and by the admin editor for
 * the live preview.
 */

const text = (max: number) => z.string().trim().max(max);
const url = z.string().trim().max(2048);

export const emailBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: text(200).min(1), level: z.union([z.literal(1), z.literal(2)]).default(2) }),
  z.object({ type: z.literal("paragraph"), text: text(5000).min(1) }),
  z.object({ type: z.literal("image"), url, alt: text(300).min(1, "Image alt text is required"), href: url.optional() }),
  z.object({ type: z.literal("gallery"), images: z.array(z.object({ url, alt: text(300).min(1) })).min(2).max(4) }),
  z.object({ type: z.literal("button"), label: text(60).min(1), href: url }),
  z.object({ type: z.literal("vehicle"), vehicleId: z.string().uuid() }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).default("md") }),
]);

export type EmailBlock = z.infer<typeof emailBlockSchema>;
export const emailBlocksSchema = z.array(emailBlockSchema).min(1, "Add at least one block").max(60);

/** Stored template blocks, or null when absent/invalid (legacy raw-HTML templates). */
export function parseEmailBlocks(raw: unknown): EmailBlock[] | null {
  const parsed = emailBlocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const BLOCK_LABELS: Record<EmailBlock["type"], string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  gallery: "Gallery",
  button: "Button",
  vehicle: "Vehicle card",
  divider: "Divider",
  spacer: "Spacer",
};

export type EmailVehicle = {
  id: string;
  title: string;
  priceText: string;
  detailText: string;
  imageUrl: string | null;
  url: string;
};

export type EmailSender = {
  /** Legal or trading name — the sender identification. */
  name: string;
  abn: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  siteUrl: string;
};

export type RenderContext = {
  sender: EmailSender;
  /** Absolute unsubscribe URL for this recipient (a placeholder in previews). */
  unsubscribeUrl: string;
  firstName: string | null;
  vehicles: Record<string, EmailVehicle | undefined>;
  preheader?: string | null;
  /** Why this person is receiving the email. */
  reason?: string;
};

const NAVY = "#0B3573";
const INK = "#14213d";
const MUTED = "#5b6980";
const FONT = "Arial,Helvetica,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Personalisation: {{firstName}} → recipient's first name (or "there"). */
function personalise(value: string, ctx: RenderContext): string {
  return value.replace(/\{\{\s*firstName\s*\}\}/g, ctx.firstName?.trim() || "there");
}

/** Absolute https URL or null. Site-relative paths resolve against the site. */
export function safeUrl(raw: string | undefined, siteUrl: string, { allowMailto = false } = {}): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (allowMailto && /^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value;
  if (/^tel:\+?[\d\s()-]{6,20}$/i.test(value)) return value.replace(/\s+/g, "");
  try {
    const u = value.startsWith("/") && !value.startsWith("//") ? new URL(value, siteUrl) : new URL(value);
    return u.protocol === "https:" || (u.protocol === "http:" && u.hostname === "localhost") ? u.toString() : null;
  } catch {
    return null;
  }
}

const row = (inner: string, padding = "0 32px") =>
  `<tr><td style="padding:${padding};font-family:${FONT};color:${INK};">${inner}</td></tr>`;

function renderBlock(block: EmailBlock, ctx: RenderContext): string {
  const site = ctx.sender.siteUrl;
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 26 : 20;
      return row(
        `<h${block.level} style="margin:0 0 12px;font-size:${size}px;line-height:1.3;font-weight:bold;color:${NAVY};">${escapeHtml(personalise(block.text, ctx))}</h${block.level}>`,
      );
    }
    case "paragraph": {
      const html = escapeHtml(personalise(block.text, ctx))
        .split(/\n{2,}/)
        .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${p.replace(/\n/g, "<br>")}</p>`)
        .join("");
      return row(html);
    }
    case "image": {
      const src = safeUrl(block.url, site);
      if (!src) return "";
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px;">`;
      const href = safeUrl(block.href, site);
      return row(`${href ? `<a href="${escapeHtml(href)}">${img}</a>` : img}`, "0 32px 16px");
    }
    case "gallery": {
      const cells = block.images
        .map((im) => {
          const src = safeUrl(im.url, site);
          return src
            ? `<td width="${Math.floor(100 / block.images.length)}%" style="padding:4px;"><img src="${escapeHtml(src)}" alt="${escapeHtml(im.alt)}" style="display:block;width:100%;height:auto;border:0;border-radius:4px;"></td>`
            : "";
        })
        .join("");
      return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`, "0 28px 16px");
    }
    case "button": {
      const href = safeUrl(block.href, site, { allowMailto: true });
      if (!href) return "";
      return row(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr><td style="border-radius:6px;background:${NAVY};">` +
          `<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(personalise(block.label, ctx))}</a>` +
          `</td></tr></table>`,
      );
    }
    case "vehicle": {
      const v = ctx.vehicles[block.vehicleId];
      if (!v) return ""; // sold/removed since the template was written: omit rather than advertise it
      const href = safeUrl(v.url, site) ?? site;
      const img = v.imageUrl ? safeUrl(v.imageUrl, site) : null;
      return row(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8f0;border-radius:8px;margin:0 0 16px;">` +
          (img ? `<tr><td><a href="${escapeHtml(href)}"><img src="${escapeHtml(img)}" alt="${escapeHtml(v.title)}" width="534" style="display:block;width:100%;height:auto;border:0;border-radius:8px 8px 0 0;"></a></td></tr>` : "") +
          `<tr><td style="padding:14px 16px;font-family:${FONT};">` +
          `<p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:${INK};">${escapeHtml(v.title)}</p>` +
          `<p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:${NAVY};">${escapeHtml(v.priceText)}</p>` +
          `<p style="margin:0 0 12px;font-size:13px;color:${MUTED};">${escapeHtml(v.detailText)}</p>` +
          `<a href="${escapeHtml(href)}" style="font-size:14px;font-weight:bold;color:${NAVY};">View this car &rarr;</a>` +
          `</td></tr></table>`,
      );
    }
    case "divider":
      return row(`<hr style="border:0;border-top:1px solid #e3e8f0;margin:8px 0 20px;">`);
    case "spacer": {
      const h = { sm: 8, md: 20, lg: 36 }[block.size];
      return `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</td></tr>`;
    }
  }
}

function renderFooter(ctx: RenderContext): string {
  const s = ctx.sender;
  const identity = [s.name, s.abn ? `ABN ${s.abn}` : ""].filter(Boolean).join(" · ");
  const contact = [s.address, s.phone, s.email].filter(Boolean).map(escapeHtml).join("<br>");
  const unsub = safeUrl(ctx.unsubscribeUrl, s.siteUrl) ?? ctx.unsubscribeUrl;
  return (
    `<tr><td style="padding:24px 32px 28px;border-top:1px solid #e3e8f0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">` +
    `<p style="margin:0 0 8px;">${escapeHtml(ctx.reason ?? `You're receiving this because you subscribed to updates from ${s.name}.`)}</p>` +
    `<p style="margin:0 0 8px;"><strong style="color:${INK};">${escapeHtml(identity)}</strong>${contact ? `<br>${contact}` : ""}</p>` +
    `<p style="margin:0;"><a href="${escapeHtml(unsub)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a> from these emails at any time.</p>` +
    `</td></tr>`
  );
}

/** Full HTML document for one recipient. */
export function renderEmailHtml(blocks: EmailBlock[], ctx: RenderContext, subject: string): string {
  const logo = ctx.sender.logoUrl ? safeUrl(ctx.sender.logoUrl, ctx.sender.siteUrl) : null;
  const header = logo
    ? `<tr><td style="padding:28px 32px 20px;"><a href="${escapeHtml(ctx.sender.siteUrl)}"><img src="${escapeHtml(logo)}" alt="${escapeHtml(ctx.sender.name)}" height="40" style="display:block;height:40px;width:auto;border:0;"></a></td></tr>`
    : `<tr><td style="padding:28px 32px 20px;font-family:${FONT};font-size:20px;font-weight:bold;color:${NAVY};">${escapeHtml(ctx.sender.name)}</td></tr>`;

  return `<!doctype html>
<html lang="en-AU">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;">
${ctx.preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(ctx.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;">
${header}
${blocks.map((b) => renderBlock(b, ctx)).join("\n")}
${renderFooter(ctx)}
</table>
</td></tr></table>
</body>
</html>`;
}

/** Plain-text alternative (multipart), including the unsubscribe link. */
export function renderEmailText(blocks: EmailBlock[], ctx: RenderContext): string {
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
      case "paragraph":
        lines.push(personalise(b.text, ctx), "");
        break;
      case "button": {
        const href = safeUrl(b.href, ctx.sender.siteUrl, { allowMailto: true });
        if (href) lines.push(`${personalise(b.label, ctx)}: ${href}`, "");
        break;
      }
      case "vehicle": {
        const v = ctx.vehicles[b.vehicleId];
        if (v) lines.push(`${v.title} — ${v.priceText}`, v.detailText, v.url, "");
        break;
      }
      case "image":
        if (b.href) lines.push(b.alt, safeUrl(b.href, ctx.sender.siteUrl) ?? "", "");
        break;
      default:
        break;
    }
  }
  const s = ctx.sender;
  lines.push(
    "—",
    [s.name, s.abn ? `ABN ${s.abn}` : ""].filter(Boolean).join(" · "),
    ...[s.address, s.phone, s.email].filter(Boolean),
    "",
    `Unsubscribe: ${ctx.unsubscribeUrl}`,
  );
  return lines.join("\n");
}

/** Vehicle ids referenced by a template (resolved from inventory at send time). */
export function referencedVehicleIds(blocks: EmailBlock[]): string[] {
  return [...new Set(blocks.flatMap((b) => (b.type === "vehicle" ? [b.vehicleId] : [])))];
}
