import { NextRequest, NextResponse } from "next/server";
import { newsletterSchema } from "@/lib/validation/newsletter";
import { rateLimitSlidingWindow } from "@/lib/security/rate-limit-redis";
import { checkSpam } from "@/lib/leads/spam-check";
import { clientIp, hashIp } from "@/lib/security/ip";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Newsletter signup → `newsletter_subscribers`.
 *
 * Subscribers are NOT leads: they have no name, phone or enquiry, so they must
 * never appear in the sales pipeline. The table is dedicated to this purpose
 * (migration 0007) and is staff-read-only under RLS, so writes go through the
 * service-role client after validation + rate limiting + honeypot.
 *
 * Idempotent on email: re-subscribing an existing address is a no-op success,
 * and re-subscribing an unsubscribed address clears `unsubscribed_at`.
 */
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
  const rl = await rateLimitSlidingWindow(`newsletter:${ipHash}`, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ data: null, error: { message: "Too many requests." } }, { status: 429 });
  }

  // Silently succeed on honeypot hit (don't tip off bots), but don't store.
  if (checkSpam({ website }).isSpam) {
    return NextResponse.json({ data: { subscribed: true }, error: null }, { status: 200 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        source: source ?? "footer",
        consent_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
      { onConflict: "email" },
    );

  if (error) {
    return NextResponse.json({ data: null, error: { message: "Could not subscribe." } }, { status: 500 });
  }

  return NextResponse.json({ data: { subscribed: true }, error: null }, { status: 200 });
}
