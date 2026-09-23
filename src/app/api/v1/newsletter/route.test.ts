import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import * as adminSupabase from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof adminSupabase.createAdminClient>;

vi.mock("@/lib/security/rate-limit-redis", () => ({
  rateLimitSlidingWindow: vi.fn(async () => ({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 })),
}));

const upsert = vi.fn(async () => ({ error: null }));
const from = vi.fn((table: string) => {
  if (table !== "newsletter_subscribers") throw new Error(`unexpected table ${table}`);
  return { upsert };
});

function request(body: unknown) {
  return new NextRequest("http://localhost/api/v1/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/newsletter", () => {
  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({ from } as unknown as AdminClient);
  });

  it("stores the subscriber in newsletter_subscribers, never in leads", async () => {
    const res = await POST(request({ email: "Buyer@Example.com", consent: true, source: "footer" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { subscribed: true }, error: null });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("newsletter_subscribers");
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, options] = upsert.mock.calls[0] as unknown as [Record<string, unknown>, { onConflict: string }];
    expect(row.email).toBe("buyer@example.com");
    expect(row.source).toBe("footer");
    expect(row.unsubscribed_at).toBeNull();
    expect(options.onConflict).toBe("email");
  });

  it("rejects an invalid email with 400 and writes nothing", async () => {
    const res = await POST(request({ email: "not-an-email", consent: true }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("silently succeeds on a honeypot hit without storing", async () => {
    const res = await POST(request({ email: "bot@example.com", consent: true, website: "http://spam" }));
    expect(res.status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 500 when the database write fails", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "boom" } } as never);
    const res = await POST(request({ email: "buyer@example.com", consent: true }));
    expect(res.status).toBe(500);
  });
});
