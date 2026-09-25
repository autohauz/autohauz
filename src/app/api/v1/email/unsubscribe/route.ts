import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTags } from "@/lib/cache";

export const runtime = "nodejs";

/**
 * RFC 8058 one-click unsubscribe. Mail clients POST here directly from the
 * List-Unsubscribe header (body "List-Unsubscribe=One-Click"); no page, no
 * confirmation, no login. The signed token identifies the contact.
 *
 * GET is not a mutation: link scanners prefetch URLs, so a GET only
 * redirects to the human confirmation page.
 */
export async function POST(request: NextRequest) {
  const payload = verifyEmailToken(request.nextUrl.searchParams.get("t"), "unsubscribe");
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });

  const { error } = await createAdminClient().rpc("unsubscribe_email_contact", {
    p_contact_id: payload.c,
    p_campaign_id: payload.k ?? null,
  });
  if (error) {
    console.error("[email] one-click unsubscribe failed:", error.message);
    return NextResponse.json({ error: "Could not unsubscribe" }, { status: 500 });
  }
  revalidateTags("email_contacts", "email_campaigns");
  return NextResponse.json({ ok: true });
}

export function GET(request: NextRequest) {
  const url = new URL("/newsletter/unsubscribe", request.nextUrl.origin);
  const t = request.nextUrl.searchParams.get("t");
  if (t) url.searchParams.set("t", t);
  return NextResponse.redirect(url, 303);
}
