import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminSupabase from "../../lib/supabase/admin";
import * as serverSupabase from "../../lib/supabase/server";

/**
 * requirePermission is the server-side authorization gate for every admin
 * page, Server Action and private data function. These tests pin its
 * decisions: unauthenticated → sign-in, non-staff → unauthorized, pending MFA
 * → /auth/mfa, insufficient role → denied, permitted → user.
 */

class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/server", () => ({
  NextResponse: { json: (body: Record<string, unknown>, init: Record<string, unknown>) => ({ ...body, ...init }) },
}));

const { requirePermission, requireApiPermission } = await import("../../lib/security/auth");

type Role = { role: string; mfa_required: boolean } | null;

function mockSession(opts: {
  user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null;
  aal?: { currentLevel: string; nextLevel: string };
}) {
  vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: opts.aal ?? { currentLevel: "aal1", nextLevel: "aal1" } }),
      },
    },
  } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
}

function mockRole(row: Role) {
  vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
      }),
    }),
  } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);
}

async function redirectOf(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
}

const staff = { id: "u1", email: "staff@example.com" };

describe("requirePermission", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.ADMIN_EMAIL_ALLOWLIST;
  });

  it("sends signed-out visitors to sign-in", async () => {
    mockSession({ user: null });
    expect(await redirectOf(requirePermission("leads.view"))).toBe("/auth/sign-in");
  });

  it("rejects signed-in users with no staff role", async () => {
    mockSession({ user: staff });
    mockRole(null);
    expect(await redirectOf(requirePermission("dashboard.view"))).toBe("/auth/sign-in?error=unauthorized");
  });

  it("ignores legacy role strings that are not staff roles", async () => {
    mockSession({ user: staff });
    mockRole({ role: "viewer", mfa_required: false });
    expect(await redirectOf(requirePermission("dashboard.view"))).toBe("/auth/sign-in?error=unauthorized");
  });

  it("demands the second factor when the role requires MFA", async () => {
    mockSession({ user: staff });
    mockRole({ role: "admin", mfa_required: true });
    expect(await redirectOf(requirePermission("dashboard.view"))).toBe("/auth/mfa");
  });

  it("demands the second factor when a factor is enrolled, even if not required", async () => {
    mockSession({ user: staff, aal: { currentLevel: "aal1", nextLevel: "aal2" } });
    mockRole({ role: "sales", mfa_required: false });
    expect(await redirectOf(requirePermission("leads.view"))).toBe("/auth/mfa");
  });

  it("denies a permission the role lacks", async () => {
    mockSession({ user: staff });
    mockRole({ role: "sales", mfa_required: false });
    expect(await redirectOf(requirePermission("staff.manage"))).toBe("/admin?denied=1");
  });

  it("returns the user with its role when permitted", async () => {
    mockSession({ user: staff, aal: { currentLevel: "aal2", nextLevel: "aal2" } });
    mockRole({ role: "manager", mfa_required: true });
    const user = await requirePermission("invoices.void");
    expect(user.staffRole).toBe("manager");
  });

  it("treats the env bootstrap allowlist as owner when no role row exists", async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "staff@example.com";
    mockSession({ user: staff });
    mockRole(null);
    const user = await requirePermission("staff.manage");
    expect(user.staffRole).toBe("owner");
  });

  it("prefers the DB role over the allowlist", async () => {
    process.env.ADMIN_EMAIL_ALLOWLIST = "staff@example.com";
    mockSession({ user: staff });
    mockRole({ role: "content", mfa_required: false });
    expect(await redirectOf(requirePermission("staff.manage"))).toBe("/admin?denied=1");
  });
});

describe("requireApiPermission", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 JSON when signed out", async () => {
    mockSession({ user: null });
    const { response } = await requireApiPermission("invoices.view");
    expect((response as unknown as { status: number }).status).toBe(401);
  });

  it("returns 403 JSON for an insufficient role", async () => {
    mockSession({ user: staff });
    mockRole({ role: "content", mfa_required: false });
    const { response } = await requireApiPermission("invoices.view");
    expect((response as unknown as { status: number }).status).toBe(403);
  });

  it("passes a permitted role", async () => {
    mockSession({ user: staff });
    mockRole({ role: "sales", mfa_required: false });
    const { user, response } = await requireApiPermission("invoices.view");
    expect(response).toBeNull();
    expect(user?.id).toBe("u1");
  });
});
