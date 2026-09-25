import "server-only";
import { transporter, FROM, REPLY_TO } from "./ses";
import { createEmailToken } from "./tokens";
import {
  parseEmailBlocks,
  referencedVehicleIds,
  renderEmailHtml,
  renderEmailText,
  type EmailBlock,
  type EmailSender,
  type EmailVehicle,
} from "./blocks";
import { getAppUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessProfile } from "@/lib/data/business";
import { formatAddress } from "@/config/business";
import { formatABN, isValidABN } from "@/lib/validation/abn";
import { site } from "@/config/site";
import { buildMediaUrl } from "@/lib/media";
import { formatKm, formatPrice, vehicleHref, FUEL_LABELS, TRANSMISSION_LABELS } from "@/lib/nav";

/**
 * Marketing email delivery.
 *
 * Campaigns are sent from a queue (email_campaign_sends, migration
 * 20260924100200): start_email_campaign() snapshots the eligible recipients
 * once, and processCampaignBatch() claims and sends a bounded batch. Batches
 * run from the "send" Server Action (first batch, so small lists finish at
 * once) and from the cron route, which drains anything larger. A crashed or
 * timed-out batch is re-claimed after 10 minutes, at most three attempts.
 */

type Supabase = ReturnType<typeof createAdminClient>;

export type EmailContent = { subject: string; previewText: string | null; blocks: EmailBlock[] };

export async function getEmailSender(): Promise<EmailSender> {
  const p = await getBusinessProfile();
  const base = getAppUrl();
  return {
    name: p.legalName || p.tradingName || site.brandName,
    abn: p.abn && isValidABN(p.abn) ? formatABN(p.abn) : "",
    address: formatAddress(p.address),
    phone: p.phone,
    email: p.email,
    logoUrl: `${base}${site.assets.logoPrimary.replace(".png", "-480.png")}`,
    siteUrl: base,
  };
}

/** Vehicle cards: only cars a customer can still buy (sold/draft are omitted). */
export async function resolveEmailVehicles(ids: string[], supabase: Supabase = createAdminClient()): Promise<Record<string, EmailVehicle>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, slug, year, variant, price, mileage_km, fuel_type, transmission, makes:make_id ( name, slug ), models:model_id ( name, slug ), vehicle_images ( is_cover, sort_order, media_assets:media_id ( storage_key ) )")
    .in("id", ids)
    .in("status", ["available", "reserved"]);
  if (error) console.error("[email] vehicle lookup failed:", error.message);

  type Row = {
    id: string; slug: string; year: number; variant: string | null; price: number | string; mileage_km: number;
    fuel_type: keyof typeof FUEL_LABELS; transmission: keyof typeof TRANSMISSION_LABELS;
    makes: { name: string; slug: string } | null; models: { name: string; slug: string } | null;
    vehicle_images: { is_cover: boolean; sort_order: number; media_assets: { storage_key: string } | null }[] | null;
  };
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const out: Record<string, EmailVehicle> = {};
  for (const v of (data ?? []) as unknown as Row[]) {
    const cover = [...(v.vehicle_images ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    out[v.id] = {
      id: v.id,
      title: [v.year, v.makes?.name, v.models?.name, v.variant].filter(Boolean).join(" "),
      priceText: formatPrice(Number(v.price)),
      detailText: [formatKm(v.mileage_km), TRANSMISSION_LABELS[v.transmission], FUEL_LABELS[v.fuel_type]].filter(Boolean).join(" · "),
      imageUrl: cover?.media_assets?.storage_key ? buildMediaUrl(supabaseUrl, cover.media_assets.storage_key) : null,
      url: vehicleHref(v.makes?.slug ?? "", v.models?.slug ?? "", v.slug),
    };
  }
  return out;
}

function buildMessage(
  content: EmailContent,
  sender: EmailSender,
  vehicles: Record<string, EmailVehicle>,
  recipient: { contactId: string; firstName: string | null },
  campaignId: string | null,
) {
  const token = createEmailToken("unsubscribe", recipient.contactId, campaignId);
  const pageUrl = `${sender.siteUrl}/newsletter/unsubscribe?t=${encodeURIComponent(token)}`;
  const oneClickUrl = `${sender.siteUrl}/api/v1/email/unsubscribe?t=${encodeURIComponent(token)}`;
  const ctx = { sender, vehicles, firstName: recipient.firstName, unsubscribeUrl: pageUrl, preheader: content.previewText };
  return {
    subject: content.subject,
    html: renderEmailHtml(content.blocks, ctx, content.subject),
    text: renderEmailText(content.blocks, ctx),
    // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo bulk-sender rules).
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function deliver(to: string, msg: ReturnType<typeof buildMessage>): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!transporter) return { ok: false, error: "SMTP not configured" };
  try {
    await transporter.sendMail({ from: FROM, replyTo: REPLY_TO, to, subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err instanceof Error ? err.message : String(err)).slice(0, 300) };
  }
}

/** Loads a campaign's content (its template's blocks). */
export async function loadCampaignContent(campaignId: string, supabase: Supabase = createAdminClient()): Promise<EmailContent | { error: string }> {
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("subject, preview_text, email_templates ( blocks, preview_text )")
    .eq("id", campaignId)
    .maybeSingle();
  if (error || !data) return { error: "Campaign not found" };
  const tpl = (data as unknown as { email_templates: { blocks: unknown; preview_text: string | null } | null }).email_templates;
  const blocks = tpl ? parseEmailBlocks(tpl.blocks) : null;
  if (!blocks) return { error: "The campaign's template has no content blocks. Open the template and save it in the block editor." };
  return { subject: data.subject, previewText: data.preview_text ?? tpl?.preview_text ?? null, blocks };
}

const BATCH_TIME_BUDGET_MS = 40_000;

/**
 * Claims and sends up to `limit` queued recipients of one campaign, then
 * closes the campaign if nothing is left. Safe to run concurrently: rows are
 * claimed with SKIP LOCKED, so no recipient is sent twice.
 */
export async function processCampaignBatch(campaignId: string, limit = 50): Promise<{ sent: number; failed: number; done: boolean; error?: string }> {
  if (!transporter) return { sent: 0, failed: 0, done: false, error: "SMTP is not configured" };
  const supabase = createAdminClient();

  const content = await loadCampaignContent(campaignId, supabase);
  if ("error" in content) return { sent: 0, failed: 0, done: false, error: content.error };

  const { data: batch, error: claimError } = await supabase.rpc("claim_email_sends", { p_campaign_id: campaignId, p_limit: limit });
  if (claimError) {
    console.error("[email] claim failed:", claimError.message);
    return { sent: 0, failed: 0, done: false, error: "Could not claim recipients" };
  }

  const [sender, vehicles] = await Promise.all([getEmailSender(), resolveEmailVehicles(referencedVehicleIds(content.blocks), supabase)]);
  const started = Date.now();
  let sent = 0;
  let failed = 0;

  type Claimed = { send_id: string; contact_id: string; email: string; first_name: string | null };
  for (const r of (batch ?? []) as Claimed[]) {
    if (Date.now() - started > BATCH_TIME_BUDGET_MS) {
      // Out of time: hand the rest back to the queue for the next run.
      await supabase.from("email_campaign_sends").update({ status: "pending" }).eq("id", r.send_id).eq("status", "processing");
      continue;
    }
    const msg = buildMessage(content, sender, vehicles, { contactId: r.contact_id, firstName: r.first_name }, campaignId);
    const result = await deliver(r.email, msg);
    const now = new Date().toISOString();
    if (result.ok) {
      sent++;
      await supabase.from("email_campaign_sends").update({ status: "sent", sent_at: now, error: null }).eq("id", r.send_id);
      await supabase.from("email_contacts").update({ last_sent_at: now }).eq("id", r.contact_id);
      await supabase.from("email_events").insert({ send_id: r.send_id, contact_id: r.contact_id, campaign_id: campaignId, event_type: "sent" });
    } else {
      failed++;
      // A relay rejection is a send failure, not a bounce: bounces need the
      // provider's feedback, which plain SMTP does not give us.
      await supabase.from("email_campaign_sends").update({ status: "failed", error: result.error }).eq("id", r.send_id);
      await supabase.from("email_events").insert({ send_id: r.send_id, contact_id: r.contact_id, campaign_id: campaignId, event_type: "failed", metadata: { error: result.error } });
    }
  }

  const { data: done } = await supabase.rpc("finish_email_campaign", { p_campaign_id: campaignId });
  return { sent, failed, done: done === true };
}

/** Sends one rendered copy to a staff address. Not recorded as a campaign send. */
export async function sendTestEmail(content: EmailContent, to: string, contactId: string): Promise<{ ok: boolean; error?: string }> {
  const [sender, vehicles] = await Promise.all([getEmailSender(), resolveEmailVehicles(referencedVehicleIds(content.blocks))]);
  const msg = buildMessage({ ...content, subject: `[TEST] ${content.subject}` }, sender, vehicles, { contactId, firstName: "Test" }, null);
  const result = await deliver(to, msg);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Double opt-in confirmation. Deliberately plain and non-promotional: it asks
 * the person to confirm and says nothing else.
 */
export async function sendSubscriptionConfirmation(contactId: string, email: string): Promise<{ sent: boolean }> {
  if (!transporter) return { sent: false };
  const sender = await getEmailSender();
  const token = createEmailToken("confirm", contactId);
  const url = `${sender.siteUrl}/newsletter/confirm?t=${encodeURIComponent(token)}`;
  const blocks: EmailBlock[] = [
    { type: "heading", text: "Please confirm your subscription", level: 1 },
    { type: "paragraph", text: `Someone (hopefully you) asked to receive email updates from ${sender.name} at this address. Confirm below to start receiving them. If this wasn't you, ignore this email and you won't hear from us.` },
    { type: "button", label: "Confirm my subscription", href: url },
  ];
  const ctx = {
    sender,
    vehicles: {},
    firstName: null,
    unsubscribeUrl: `${sender.siteUrl}/newsletter/unsubscribe`,
    reason: `You're receiving this one-off email because this address was entered on ${sender.siteUrl.replace(/^https?:\/\//, "")}.`,
  };
  try {
    await transporter.sendMail({
      from: FROM,
      replyTo: REPLY_TO,
      to: email,
      subject: `Confirm your subscription to ${sender.name}`,
      html: renderEmailHtml(blocks, ctx, "Confirm your subscription"),
      text: renderEmailText(blocks, ctx),
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] confirmation send failed:", err instanceof Error ? err.message : err);
    return { sent: false };
  }
}
