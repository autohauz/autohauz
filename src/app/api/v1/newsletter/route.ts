import { NextRequest, NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation/newsletter";
import { rateLimitSlidingWindow } from "@/lib/security/rate-limit-redis";
import { checkSpam } from "@/lib/leads/spam-check";
import { clientIp, hashIp } from "@/lib/security/ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSubscriptionConfirmation } from "@/lib/email/marketing";

export const runtime = "nodejs";

/**
 * Newsletter signup → email_contacts, double opt-in.
 *
 * Nobody becomes "subscribed" from this endpoint: the contact is stored as
 * `pending` and a confirmation link is emailed; only that link subscribes
 * (subscribe_request / confirm_subscription, migration 20260924100200). So
 * typing someone else's address can never put them on the marketing list,
 * and an address that unsubscribed is never silently re-added.
 *
 * The response is identical whatever the outcome, so the endpoint cannot be
 * used to learn whether an address is on the list.
 */
const accepted = () => NextResponse.json({ data: { status: "check_email" }, error: null }, { status: 200 });

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ data: null, error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = newsletterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: { message: "Enter a valid email." } }, { status: 400 });
  }
  const { email, source, website } = parsed.data;

  const ipHash = hashIp(clientIp(request.headers));
  // Per IP, and per address (so the confirmation email cannot be used to spam someone).
  for (const [key, limit, windowMs] of [
    [`newsletter:ip:${ipHash}`, 5, 10 * 60 * 1000],
    [`newsletter:email:${email}`, 2, 60 * 60 * 1000],
  ] as const) {
    const rl = await rateLimitSlidingWindow(key, limit, windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ data: null, error: { message: "Too many requests. Please try again later." } }, { status: 429 });
    }
  }

  // Honeypot: pretend success, store nothing.
  if (checkSpam({ website }).isSpam) return accepted();

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("subscribe_request", {
    p_email: email,
    p_source: source ?? "footer",
    p_ip_hash: ipHash,
  });
  if (error) {
    console.error("[newsletter] subscribe_request failed:", error.message);
    return NextResponse.json({ data: null, error: { message: "Could not subscribe. Please try again." } }, { status: 500 });
  }

  const row = (data as { contact_id: string | null; outcome: string }[] | null)?.[0];
  if (row?.outcome === "confirm" && row.contact_id) {
    const { sent } = await sendSubscriptionConfirmation(row.contact_id, email);
    if (sent) {
      await supabase.from("email_contacts").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", row.contact_id);
    }
  }

  return accepted();
}
