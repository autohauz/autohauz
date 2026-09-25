import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const contact = "11111111-1111-4111-8111-111111111111";
const campaign = "22222222-2222-4222-8222-222222222222";

describe("email tokens", async () => {
  const { createEmailToken, verifyEmailToken } = await import("./tokens");

  it("round-trips an unsubscribe token with campaign attribution", () => {
    const t = createEmailToken("unsubscribe", contact, campaign);
    expect(verifyEmailToken(t, "unsubscribe")).toMatchObject({ c: contact, k: campaign, a: "unsubscribe" });
  });

  it("rejects the wrong action, tampering and garbage", () => {
    const t = createEmailToken("unsubscribe", contact);
    expect(verifyEmailToken(t, "confirm")).toBeNull();
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ c: campaign, a: "unsubscribe", e: 9_999_999_999 })).toString("base64url");
    expect(verifyEmailToken(`${forged}.${mac}`, "unsubscribe")).toBeNull();
    expect(verifyEmailToken(`${body}.${mac.slice(0, -2)}xx`, "unsubscribe")).toBeNull();
    expect(verifyEmailToken(contact, "unsubscribe")).toBeNull(); // the old raw-UUID links
    expect(verifyEmailToken("", "unsubscribe")).toBeNull();
    expect(verifyEmailToken(null, "unsubscribe")).toBeNull();
  });

  it("expires: confirm after 7 days, unsubscribe after a year (Spam Act minimum is 30 days)", () => {
    const now = Date.UTC(2026, 0, 1);
    const confirmToken = createEmailToken("confirm", contact, null, now);
    expect(verifyEmailToken(confirmToken, "confirm", now + 6 * 86400_000)).not.toBeNull();
    expect(verifyEmailToken(confirmToken, "confirm", now + 8 * 86400_000)).toBeNull();
    const unsub = createEmailToken("unsubscribe", contact, null, now);
    expect(verifyEmailToken(unsub, "unsubscribe", now + 300 * 86400_000)).not.toBeNull();
    expect(verifyEmailToken(unsub, "unsubscribe", now + 400 * 86400_000)).toBeNull();
  });
});
