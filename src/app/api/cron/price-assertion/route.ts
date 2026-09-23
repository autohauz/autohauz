import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/nav";
import { getAppUrl } from "@/lib/config";
import { requireCronSecret } from "@/lib/security/cron";

export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const baseUrl = getAppUrl();

  // We only assert vehicles currently available and pushed to a channel.
  // We can just assert all available vehicles in the projection.
  const { data: vehicles } = await supabase
    .from("syndication_vehicle_projection")
    .select("vehicle_id, make, model, stock_number, price_amount")
    .eq("status", "available");

  if (!vehicles || vehicles.length === 0) {
    return NextResponse.json({ success: true, checked: 0, errors: [] });
  }

  const errors = [];
  let checked = 0;

  for (const v of vehicles) {
    const makeSlug = v.make.toLowerCase().replace(/\s+/g, '-');
    const modelSlug = v.model.toLowerCase().replace(/\s+/g, '-');
    const slug = v.stock_number.toLowerCase();
    const vdpUrl = `${baseUrl}/used-cars/${makeSlug}/${modelSlug}/${slug}`;
    
    try {
      const res = await fetch(vdpUrl);
      if (!res.ok) {
        errors.push({ vehicle_id: v.vehicle_id, error: `VDP returned ${res.status} at ${vdpUrl}` });
        continue;
      }
      
      const html = await res.text();
      const expectedPriceStr = formatPrice(v.price_amount);
      
      // Basic assertion: the expected formatted price must exist on the page.
      if (!html.includes(expectedPriceStr)) {
        errors.push({ 
          vehicle_id: v.vehicle_id, 
          error: `Price mismatch: Expected ${expectedPriceStr} not found in VDP.` 
        });
      }
      checked++;
    } catch (error) {
      const e = error as Error;
      errors.push({ vehicle_id: v.vehicle_id, error: e.message });
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      await supabase.from("syndication_event").insert({
        vehicle_id: err.vehicle_id,
        event_type: "price_assertion_failed",
        detail: { error: err.error }
      });
    }
  }

  return NextResponse.json({ success: true, checked, errors });
}
