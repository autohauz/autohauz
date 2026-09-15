import { describe, it, expect, vi, beforeEach } from "vitest";
import { userHasAdminAccess, requireApiAdmin } from "../../lib/security/auth";
import * as adminSupabase from "../../lib/supabase/admin";
import * as serverSupabase from "../../lib/supabase/server";

// Mock redirect to capture it
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Next.js cache so it doesn't break our tests
vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init: any) => ({ ...body, ...init }),
  },
}));

describe("Admin Authentication Timeout Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = { id: "user-123", email: "user@example.com" };

  it("should return false if admin_roles lookup returns no data and no error (normal non-admin)", async () => {
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    } as any);

    const result = await userHasAdminAccess(mockUser as any);
    expect(result).toBe(false);
  });

  it("should throw an error if admin_roles lookup times out (error is populated)", async () => {
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: { message: "Network timeout" } }),
              }),
            }),
          }),
        }),
      }),
    } as any);

    await expect(userHasAdminAccess(mockUser as any)).rejects.toThrow("Database error during admin role lookup: Network timeout");
  });

  it("requireApiAdmin should return 500 when database timeout occurs", async () => {
    // Mock requireApiUser to return the user
    vi.spyOn(serverSupabase, "createClient").mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: mockUser }, error: null }),
      }
    } as any);

    // Mock admin client to throw error
    vi.spyOn(adminSupabase, "createAdminClient").mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: { message: "Database timeout" } }),
              }),
            }),
          }),
        }),
      }),
    } as any);

    const { user, response } = await requireApiAdmin();
    expect(user).toBeNull();
    expect(response?.status).toBe(500);
    expect(response?.error).toBe("Internal server error during authorization");
  });
});
