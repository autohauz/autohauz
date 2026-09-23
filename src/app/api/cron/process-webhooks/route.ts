import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/security/cron";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  // 1. Fetch pending webhook events
  const { data: events, error: fetchErr } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ success: true, message: "No pending events" }, { status: 200 });
  }

  // Mark them as processing
  const eventIds = events.map(e => e.id);
  await supabase
    .from("webhook_events")
    .update({ status: "processing" })
    .in("id", eventIds);

  const pageAccessToken = env.META_PAGE_ACCESS_TOKEN;
  let processedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    try {
      if (event.channel_code === "meta_marketplace") {
        const entries = event.payload.entry || [];
        for (const entry of entries) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === "leadgen" && change.value?.leadgen_id) {
              const leadgenId = change.value.leadgen_id;

              // Fetch from Meta Graph API
              if (!pageAccessToken) {
                throw new Error("Missing META_PAGE_ACCESS_TOKEN");
              }

              const res = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`);
              if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Graph API error: ${res.status} ${errorText}`);
              }

              const leadData = await res.json();
              
              // Extract fields (Meta sends an array of field_data)
              let name = "Meta Lead";
              let phone = "";
              let email = "";
              let vehicleId: string | null = null;
              
              const fieldData = leadData.field_data || [];
              for (const field of fieldData) {
                if (field.name === "full_name") name = field.values[0];
                if (field.name === "phone_number") phone = field.values[0];
                if (field.name === "email") email = field.values[0];
                if (field.name === "vehicle_id") vehicleId = field.values[0]; // Partner-defined custom field if any
              }

              // F20: Nullable vehicleId supported.
              // F21: Dedupe with channel_code + channel_lead_id
              const { error: upsertErr } = await supabase
                .from("leads")
                .upsert({
                  channel_code: "meta_marketplace",
                  channel_lead_id: leadgenId,
                  type: "vehicle_enquiry",
                  status: "new",
                  name: name || "Meta Lead",
                  phone: phone || "000000000", // Fallback, E.164 normalized in real app
                  email: email || null,
                  vehicle_id: vehicleId,
                  payload: leadData
                }, { onConflict: "channel_code,channel_lead_id" });

              if (upsertErr) {
                throw upsertErr;
              }
            }
          }
        }
      }

      await supabase
        .from("webhook_events")
        .update({ status: "complete", processed_at: new Date().toISOString() })
        .eq("id", event.id);
      
      processedCount++;
    } catch (error) {
      const err = error as Error;
      console.error(`Error processing webhook event ${event.id}:`, err);
      await supabase
        .from("webhook_events")
        .update({ status: "failed", error: err.message, processed_at: new Date().toISOString() })
        .eq("id", event.id);
      errorCount++;
    }
  }

  return NextResponse.json({ success: true, processedCount, errorCount }, { status: 200 });
}
