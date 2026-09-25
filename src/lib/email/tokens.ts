import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Signed, stateless email-link tokens (unsubscribe, confirm subscription).
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256). The payload
 * names the contact, the action and an expiry; nothing is guessable (the old
 * links used the raw contact UUID, which also leaked it). Unsubscribe links
 * stay valid for a year — the Spam Act requires them to keep working for at
 * least 30 days after the message is sent.
 */
export type EmailTokenAction = "unsubscribe" | "confirm";

export type EmailTokenPayload = {
  /** contact id */
  c: string;
  /** campaign id (unsubscribe attribution), optional */
  k?: string | null;
  a: EmailTokenAction;
  /** expiry, unix seconds */
  e: number;
};

const TTL_SECONDS: Record<EmailTokenAction, number> = {
  unsubscribe: 365 * 24 * 3600,
  confirm: 7 * 24 * 3600,
};

function secret(): string {
  if (env.EMAIL_TOKEN_SECRET) return env.EMAIL_TOKEN_SECRET;
  // Domain-separated derivation so the service key itself is never the HMAC key.
  return createHash("sha256").update(`email-token:${env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex");
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string): string {
  return b64(createHmac("sha256", secret()).update(body).digest());
}

export function createEmailToken(
  action: EmailTokenAction,
  contactId: string,
  campaignId?: string | null,
  now = Date.now(),
): string {
  const payload: EmailTokenPayload = { c: contactId, a: action, e: Math.floor(now / 1000) + TTL_SECONDS[action] };
  if (campaignId) payload.k = campaignId;
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyEmailToken(token: string | null | undefined, action: EmailTokenAction, now = Date.now()): EmailTokenPayload | null {
  if (!token || token.length > 1024) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: EmailTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.a !== action || !UUID.test(payload.c) || (payload.k && !UUID.test(payload.k))) return null;
  if (typeof payload.e !== "number" || payload.e * 1000 < now) return null;
  return payload;
}
