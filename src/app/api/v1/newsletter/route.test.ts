import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as adminSupabase from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof adminSupabase.createAdminClient>;

vi.mock("@/lib/security/rate-limit-redis", () => ({
  rateLimitSlidingWindow: vi.fn(async () => ({ allowed: true, remaining: 4, resetAt: new Date(Date.now() + 1000) })),
}));

const sendSubscriptionConfirmation = vi.fn(async () => ({ sent: true }));
vi.mock("@/lib/email/marketing", () => ({ sendSubscriptionConfirmation: (...a: unknown[]) => sendSubscriptionConfirmation(...(a as [])) }));

const { POST } = await import("./route");

const rpc = vi.fn();
const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const from = vi.fn(() => ({ update }));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/v1/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/newsletter (double opt-in)", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendSubscriptionConfirmation.mockClear();
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({ rpc, from } as unknown as AdminClient);
  });

  it("requests a subscription and emails a confirmation link, never subscribing directly", async () => {
    rpc.mockResolvedValue({ data: [{ contact_id: "c1", outcome: "confirm" }], error: null });
    const res = await POST(request({ email: "Buyer@Example.com", consent: true, source: "footer" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { status: "check_email" }, error: null });
    expect(rpc).toHaveBeenCalledWith("subscribe_request", expect.objectContaining({ p_email: "buyer@example.com", p_source: "footer" }));
    expect(sendSubscriptionConfirmation).toHaveBeenCalledWith("c1", "buyer@example.com");
  });

  it("gives the same answer for existing or blocked addresses and sends nothing", async () => {
    for (const outcome of ["already_subscribed", "blocked"]) {
      rpc.mockResolvedValueOnce({ data: [{ contact_id: null, outcome }], error: null });
      const res = await POST(request({ email: "x@example.com", consent: true }));
      await expect(res.json()).resolves.toEqual({ data: { status: "check_email" }, error: null });
    }
    expect(sendSubscriptionConfirmation).not.toHaveBeenCalled();
  });

  it("rejects an invalid email with 400 and writes nothing", async () => {
    const res = await POST(request({ email: "not-an-email", consent: true }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("requires explicit consent", async () => {
    const res = await POST(request({ email: "a@example.com" }));
    expect(res.status).toBe(400);
  });

  it("silently succeeds on a honeypot hit without storing", async () => {
    const res = await POST(request({ email: "bot@example.com", consent: true, website: "http://spam" }));
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 500 when the database call fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await POST(request({ email: "buyer@example.com", consent: true }));
    expect(res.status).toBe(500);
  });
});
