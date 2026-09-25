import { describe, it, expect, vi } from "vitest";
import { updateVehicle } from "@/app/admin/inventory/actions";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// Mock auth
vi.mock("@/lib/security/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: "admin-123" }),
  requirePermission: vi.fn().mockResolvedValue({ id: "admin-123", staffRole: "admin" }),
}));

// Mock supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

describe("updateVehicle", () => {
  it("should not throw an error", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }), in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        insert: vi.fn().mockImplementation(() => {
          const res = Promise.resolve({ data: [{ id: "new-media-id", storage_key: "vehicles/test.webp" }], error: null }) as Promise<unknown> & { select?: unknown };
          res.select = vi.fn().mockResolvedValue({ data: [{ id: "new-media-id", storage_key: "vehicles/test.webp" }], error: null });
          return res;
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
    };
    vi.mocked(createAdminClient).mockReturnValue(mockSupabase as unknown as AdminClient);

    const formData = new FormData();
    formData.append("id", "123e4567-e89b-12d3-a456-426614174000"); // Valid UUID
    formData.append("year", "2020");
    formData.append("stockId", "STK123");
    formData.append("makeId", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("modelId", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("status", "draft");
    formData.append("price", "20000");
    formData.append("imageKeys", JSON.stringify([
      { path: "vehicles/test.webp", url: "http://test.webp", isCover: true }
    ]));

    try {
      const result = await updateVehicle(null, formData);
      console.log("Result:", result);
      expect(result.error).toBeUndefined();
    } catch (e) {
      console.error("Action threw an error:", e);
      throw e;
    }
  });
});
