import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // No default: an unset verify token must fail the handshake, never pass it.
  const verifyToken = env.META_WEBHOOK_VERIFY_TOKEN ?? process.env.META_VERIFY_TOKEN;

  if (!verifyToken) {
    return NextResponse.json({ error: "Webhook verify token not configured" }, { status: 503 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    if (!signatureHeader) {
      console.warn("Meta Webhook: Missing X-Hub-Signature-256");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("META_APP_SECRET is not configured");
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

    const expectedSig = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");

    const expectedBuffer = Buffer.from(expectedSig);
    const actualBuffer = Buffer.from(signatureHeader);

    // F4: verify X-Hub-Signature-256 with constant-time compare
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      console.warn("Meta Webhook: Signature mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // F21: Insert the raw payload into webhook_events and return 200 within 5s
    const payload = JSON.parse(rawBody);
    
    // In Meta Webhooks, payload.object typically describes the event type (e.g., 'page')
    if (payload.object === "page") {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("webhook_events")
        .insert({
          channel_code: "meta_marketplace",
          payload,
          status: "pending"
        });

      if (error) {
        console.error("Meta Webhook: Failed to enqueue event", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Meta Webhook: Unhandled error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
