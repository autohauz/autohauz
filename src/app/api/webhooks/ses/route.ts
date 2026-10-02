import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import MessageValidator from "sns-validator";

export const runtime = "nodejs";

const validator = new MessageValidator();

function validateMessage(payload: string | Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    validator.validate(payload, (err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

/**
 * Handles AWS SES events via Amazon SNS HTTP(S) subscriptions.
 * https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html
 */
export async function POST(request: NextRequest) {
  try {
    const type = request.headers.get("x-amz-sns-message-type");
    
    // AWS SNS sends payload as text, although it is JSON.
    const rawBody = await request.text();
    if (!rawBody) {
      return new NextResponse("Empty body", { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    // Verify SNS signature
    let verifiedMessage: Record<string, unknown>;
    try {
      verifiedMessage = await validateMessage(payload) as Record<string, unknown>;
    } catch (err) {
      console.error("[ses webhook] invalid signature:", err);
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 1. Subscription Confirmation
    if (type === "SubscriptionConfirmation") {
      const subscribeUrl = verifiedMessage.SubscribeURL as string;
      if (subscribeUrl) {
        // Fetch to confirm subscription to the SNS topic
        await fetch(subscribeUrl);
        return new NextResponse("Subscribed", { status: 200 });
      }
      return new NextResponse("Missing URL", { status: 400 });
    }

    // 2. Notification (Bounce, Complaint, Delivery)
    if (type === "Notification") {
      const message = JSON.parse(verifiedMessage.Message as string);
      const notificationType = message.notificationType;
      
      const supabase = createAdminClient();

      if (notificationType === "Bounce") {
        const bounce = message.bounce;
        if (bounce.bounceType === "Permanent") {
          const recipients = bounce.bouncedRecipients.map((r: { emailAddress: string }) => r.emailAddress);
          for (const email of recipients) {
            // Mark contact as bounced
            await supabase.from("email_contacts").update({ subscription_status: "bounced" }).eq("email", email);
            // Add to suppressions
            await supabase.from("email_suppressions").upsert({ email, reason: "hard_bounce" }, { onConflict: "email" });
          }
        }
      } else if (notificationType === "Complaint") {
        const complaint = message.complaint;
        const recipients = complaint.complainedRecipients.map((r: { emailAddress: string }) => r.emailAddress);
        for (const email of recipients) {
          // Mark contact as complained
          await supabase.from("email_contacts").update({ subscription_status: "complained" }).eq("email", email);
          // Add to suppressions
          await supabase.from("email_suppressions").upsert({ email, reason: "spam_complaint" }, { onConflict: "email" });
        }
      }
      
      return new NextResponse("Processed", { status: 200 });
    }

    return new NextResponse("Ignored", { status: 200 });
  } catch (error) {
    console.error("[ses webhook] error:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
