import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/security/cron";

export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  // Find vehicles with tiktok_url but no tiktok_embed_html
  const { data: vehicles, error } = await supabase
    .from("syndication_vehicle_extra")
    .select("vehicle_id, tiktok_url")
    .not("tiktok_url", "is", null)
    .is("tiktok_embed_html", null)
    .limit(10); // batch size

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processedCount = 0;
  let errorCount = 0;

  for (const v of vehicles) {
    try {
      if (!v.tiktok_url) continue;

      // Strict host allow-list: `includes("tiktok.com")` would accept
      // https://evil.example/?u=tiktok.com. The oEmbed endpoint is always
      // TikTok's own, so this only protects against junk rows, but the stored
      // HTML is untrusted input to any future renderer and must stay clean.
      let host: string;
      try {
        host = new URL(v.tiktok_url).hostname.toLowerCase();
      } catch {
        throw new Error("Invalid TikTok URL");
      }
      if (!["www.tiktok.com", "tiktok.com", "vm.tiktok.com", "m.tiktok.com"].includes(host)) {
        throw new Error("URL is not a TikTok host");
      }

      // Fetch oEmbed HTML
      const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(v.tiktok_url)}`);
      
      if (!res.ok) {
        throw new Error(`oEmbed failed: ${res.status}`);
      }

      const data = await res.json();
      const html = data.html;

      if (!html) {
        throw new Error("No HTML returned in oEmbed response");
      }

      const { error: updateErr } = await supabase
        .from("syndication_vehicle_extra")
        .update({ tiktok_embed_html: html })
        .eq("vehicle_id", v.vehicle_id);

      if (updateErr) throw updateErr;

      processedCount++;
    } catch (err) {
      console.error(`TikTok Sync Error for vehicle ${v.vehicle_id}:`, err);
      errorCount++;
    }
  }

  return NextResponse.json({ success: true, processedCount, errorCount });
}
