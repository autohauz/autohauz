import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextResponse } from "next/server";
import { userHasAdminAccess, requireApiAdmin } from "../../lib/security/auth";
import * as adminSupabase from "../../lib/supabase/admin";
import * as serverSupabase from "../../lib/supabase/server";

type AdminClient = ReturnType<typeof adminSupabase.createAdminClient>;
type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;
type SupabaseUser = Parameters<typeof userHasAdminAccess>[0];

/** The mocked `NextResponse.json` returns a plain object merging body + init. */
type MockedJsonResponse = NextResponse & { status: number; error: string };

// Mock redirect to capture it
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock React's cache so per-request memoisation is a pass-through in tests
vi.mock("react", () => ({
  cache: <T,>(fn: T) => fn,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: Record<string, unknown>, init: Record<string, unknown>) => ({ ...body, ...init }),
  },
}));

/** Minimal chainable stand-in for `.from().select().eq().eq().limit().maybeSingle()`. */
function adminClientReturning(result: { data: unknown; error: { message: string } | null }): AdminClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => result,
            }),
          }),
        }),
      }),
    }),
  } as unknown as AdminClient;
}

describe("Admin Authentication Timeout Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = { id: "user-123", email: "user@example.com" } as SupabaseUser;

  it("should return false if admin_roles lookup returns no data and no error (normal non-admin)", async () => {
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(adminClientReturning({ data: null, error: null }));

    const result = await userHasAdminAccess(mockUser);
    expect(result).toBe(false);
  });

  it("should throw an error if admin_roles lookup times out (error is populated)", async () => {
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(
      adminClientReturning({ data: null, error: { message: "Network timeout" } }),
    );

    await expect(userHasAdminAccess(mockUser)).rejects.toThrow("Database error during admin role lookup: Network timeout");
  });

  it("requireApiAdmin should return 500 when database timeout occurs", async () => {
    // Mock requireApiUser to return the user
    vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: mockUser }, error: null }),
      },
    } as unknown as ServerClient);

    // Mock admin client to surface a DB error
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue(
      adminClientReturning({ data: null, error: { message: "Database timeout" } }),
    );

    const { user, response } = await requireApiAdmin();
    const mocked = response as MockedJsonResponse | null;
    expect(user).toBeNull();
    expect(mocked?.status).toBe(500);
    expect(mocked?.error).toBe("Internal server error during authorization");
  });
});
