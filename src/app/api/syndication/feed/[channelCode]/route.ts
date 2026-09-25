import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFeedToken } from "@/lib/syndication/feed-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelCode: string }> }
) {
  const { channelCode } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  
  if (!token) {
    return new NextResponse("Missing feed token", { status: 401 });
  }

  const supabase = createAdminClient();
  
  // Get the default dealer
  const { data: dealer } = await supabase
    .from("syndication_dealer")
    .select("id")
    .eq("is_default", true)
    .single();

  if (!dealer) return new NextResponse("Configuration error", { status: 500 });

  const { data: connection } = await supabase
    .from("channel_connection")
    .select("feed_token, feed_token_previous, feed_token_rotated_at, channel!inner(enabled, transport_kind)")
    .eq("dealer_id", dealer.id)
    .eq("channel_code", channelCode)
    .single();

  if (!connection) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Supabase types might infer joined tables as arrays
  const channelData = Array.isArray(connection.channel) ? connection.channel[0] : connection.channel;

  if (!channelData?.enabled) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (channelData.transport_kind !== "pull_feed") {
    return new NextResponse("Channel is not a pull feed", { status: 400 });
  }

  const match = verifyFeedToken({
    presented: token,
    current: connection.feed_token,
    previous: connection.feed_token_previous,
    rotatedAt: connection.feed_token_rotated_at ? new Date(connection.feed_token_rotated_at) : null,
    now: new Date()
  });

  if (match === "none") {
    return new NextResponse("Invalid feed token", { status: 403 });
  }

  // Token is valid. Fetch the actual feed from bucket.
  const bucketName = process.env.FEED_STORAGE_BUCKET || "syndication-feeds";
  const finalKey = `${dealer.id}/${channelCode}.csv`;

  const { data: fileData, error: downloadErr } = await supabase.storage.from(bucketName).download(finalKey);

  if (downloadErr || !fileData) {
    return new NextResponse("Feed not yet generated", { status: 503 });
  }

  return new NextResponse(fileData, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // The URL carries the access token, so a shared CDN copy would keep
      // serving the feed for a day after the token is revoked. Channels poll
      // hourly at most; a short private cache is enough.
      "Cache-Control": "private, max-age=300"
    }
  });
}
