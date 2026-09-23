import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validation/lead";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { rateLimitSlidingWindow } from "@/lib/security/rate-limit-redis";
import { checkSpam, normalizePhone } from "@/lib/leads/spam-check";
import { clientIp, hashIp } from "@/lib/security/ip";
import { notifyNewLead } from "@/lib/leads/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Keys handled explicitly; everything else on a validated lead goes to payload.
const COMMON_KEYS = new Set([
  "type", "name", "phone", "email", "message", "consent",
  "website", "formRenderedAt", "turnstileToken", "meta", "vehicleId",
]);

function buildPayload(data: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!COMMON_KEYS.has(k) && v !== undefined && v !== "") payload[k] = v;
  }
  return payload;
}

async function vehicleTitle(vehicleId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vehicles")
    .select("year, variant, makes:make_id(name), models:model_id(name)")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return `${d.year} ${d.makes?.name ?? ""} ${d.models?.name ?? ""}${d.variant ? ` ${d.variant}` : ""}`.trim();
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { message: "Validation failed", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const ip = clientIp(request.headers);
  const ipHash = hashIp(ip);
  const phone = normalizePhone(data.phone);

  // Rate limit: 5 per 10 min per IP-hash AND per phone (SRS §20).
  for (const key of [`lead:ip:${ipHash}`, `lead:phone:${phone}`]) {
    const rl = await rateLimitSlidingWindow(key, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { data: null, error: { message: "Too many requests. Please try again shortly." } },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
      );
    }
  }

  // Anti-spam: honeypot + time-to-submit + disposable email. Spam is silently
  // quarantined (status='spam') — the client still gets a success response so
  // bots aren't taught what tripped the filter.
  const spam = checkSpam({ website: data.website, formRenderedAt: data.formRenderedAt, email: data.email || undefined });

  // Turnstile (skipped in dev / when unconfigured).
  const turnstile = await verifyTurnstile(data.turnstileToken, ip);
  const flaggedSpam = spam.isSpam || !turnstile.ok;

  const supabase = createAdminClient();
  const meta = data.meta ?? {};
  const leadRecord = {
    type: data.type,
    status: flaggedSpam ? "spam" : "new",
    name: data.name,
    phone,
    email: data.email || null,
    message: data.message || null,
    vehicle_id: "vehicleId" in data ? data.vehicleId ?? null : null,
    payload: buildPayload(data as Record<string, unknown>),
    source_url: meta.sourceUrl ?? null,
    utm: meta.utm ?? {},
    referrer: meta.referrer ?? null,
    device: meta.device ?? "unknown",
    ip_hash: ipHash,
    consent: { given: data.consent === true, at: new Date().toISOString() },
  };

  // Durable persist BEFORE acknowledging (zero-lead-loss, SRS NFR-4).
  const { data: leadId, error } = await supabase.rpc("create_lead_with_event", { p_lead: leadRecord });
  if (error || !leadId) {
    return NextResponse.json({ data: null, error: { message: "Could not save your enquiry. Please call us." } }, { status: 500 });
  }

  // Notify sales (best-effort; genuine leads only). Never blocks the response.
  if (!flaggedSpam) {
    const title = leadRecord.vehicle_id ? await vehicleTitle(leadRecord.vehicle_id) : null;
    const res = await notifyNewLead({
      type: data.type,
      name: data.name,
      phone,
      email: data.email,
      message: data.message,
      vehicleTitle: title,
      sourceUrl: leadRecord.source_url,
    });
    if (res.sent) {
      await supabase.from("lead_events").insert({ lead_id: leadId, event: "notified", data: {} });
    }
  }

  return NextResponse.json({ data: { leadId }, error: null }, { status: 201 });
}
