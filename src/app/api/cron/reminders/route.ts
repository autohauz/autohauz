import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStaffReminderEmail } from "@/lib/email/ses";
import { notificationRecipients } from "@/lib/leads/notify";
import { getAppUrl } from "@/lib/config";
import { requireCronSecret } from "@/lib/security/cron";

/** Leads still "new" after this long are overdue for first contact. */
const STALE_LEAD_HOURS = 24;

export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const staleBefore = new Date(Date.now() - STALE_LEAD_HOURS * 60 * 60 * 1000).toISOString();

  const [{ count: staleNewLeads }, { count: draftVehicles }] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .lt("created_at", staleBefore),
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
  ]);

  const results = { staleNewLeads: staleNewLeads ?? 0, draftVehicles: draftVehicles ?? 0, reminded: false };

  // Nothing to nudge about — stay quiet rather than send an empty digest.
  if (results.staleNewLeads === 0 && results.draftVehicles === 0) {
    return NextResponse.json({ success: true, results });
  }

  const to = await notificationRecipients();
  const sent = await sendStaffReminderEmail({
    to,
    staleNewLeads: results.staleNewLeads,
    draftVehicles: results.draftVehicles,
    adminUrl: `${getAppUrl()}/admin`,
  });
  results.reminded = !sent.skipped;

  return NextResponse.json({ success: true, results });
}
