import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/syndication/engine";
import { requireCronSecret } from "@/lib/security/cron";

export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  // Find all enabled connections
  const { data: connections, error } = await supabase
    .from("channel_connection")
    .select("dealer_id, channel_code, channel!inner(enabled)")
    .eq("status", "connected")
    .eq("channel.enabled", true);

  if (error || !connections) {
    return NextResponse.json({ error: "Failed to fetch connections", details: error?.message }, { status: 500 });
  }

  const results = [];
  for (const conn of connections) {
    try {
      const res = await runSync(conn.dealer_id, conn.channel_code, "scheduled");
      results.push({ channelCode: conn.channel_code, result: res });
    } catch (error) {
      const e = error as Error;
      results.push({ channelCode: conn.channel_code, result: { success: false, reason: e.message } });
    }
  }

  return NextResponse.json({ success: true, results });
}
