import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/security/cron";
import { processCampaignBatch } from "@/lib/email/marketing";
import { revalidateTags } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Email campaign worker (vercel.json cron):
 *  1. starts scheduled campaigns whose time has come (atomic, conditional);
 *  2. sends the next batches of campaigns that are mid-send.
 * Each batch is claimed with SKIP LOCKED, so this can overlap with a send
 * started from the admin panel without sending anyone twice.
 */
export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const started: string[] = [];
  const failedToStart: string[] = [];

  const { data: due } = await supabase
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(10);
  for (const { id } of due ?? []) {
    const { error } = await supabase.rpc("start_email_campaign", { p_campaign_id: id });
    if (error) {
      console.error(`[cron:email] could not start ${id}:`, error.message);
      failedToStart.push(id);
    } else {
      started.push(id);
    }
  }

  const { data: sending } = await supabase.from("email_campaigns").select("id").eq("status", "sending").limit(10);
  const deadline = Date.now() + 45_000;
  let sent = 0;
  let failed = 0;
  for (const { id } of sending ?? []) {
    while (Date.now() < deadline) {
      const batch = await processCampaignBatch(id, 100);
      sent += batch.sent;
      failed += batch.failed;
      if (batch.error || batch.done || batch.sent + batch.failed === 0) break;
    }
  }

  revalidateTags("email_campaigns");
  return NextResponse.json({ started: started.length, failedToStart: failedToStart.length, sent, failed });
}
