import { beforeEach, describe, expect, it, vi } from "vitest";
import { setVehicleStatus } from "@/app/admin/inventory/actions";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

vi.mock("@/lib/security/auth", () => ({
  requirePermission: vi.fn().mockResolvedValue({ id: "admin-123", staffRole: "admin" }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));

const ID = "123e4567-e89b-12d3-a456-426614174000";

/** A client whose read returns `current` and which records the update patch. */
function mockClient(current: { status: string; published_at: string | null } | null) {
  const patches: Record<string, unknown>[] = [];
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: current, error: null }) }),
      }),
      update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        patches.push(patch);
        return { eq: vi.fn().mockResolvedValue({ error: null }) };
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as AdminClient);
  return patches;
}

describe("setVehicleStatus", () => {
  beforeEach(() => vi.mocked(createAdminClient).mockReset());

  it("rejects an unknown status without touching the database", async () => {
    const patches = mockClient({ status: "draft", published_at: null });
    expect(await setVehicleStatus(ID, "deleted")).toEqual({ error: "Unknown status" });
    expect(patches).toHaveLength(0);
  });

  it("sets published_at on first publication only", async () => {
    let patches = mockClient({ status: "draft", published_at: null });
    await setVehicleStatus(ID, "available");
    expect(patches[0].published_at).toEqual(expect.any(String));

    patches = mockClient({ status: "available", published_at: "2026-01-01T00:00:00.000Z" });
    await setVehicleStatus(ID, "reserved");
    expect(patches[0]).toEqual({ status: "reserved" });
  });

  it("stamps sold_at on sale and clears it when a sale falls through", async () => {
    let patches = mockClient({ status: "reserved", published_at: "2026-01-01T00:00:00.000Z" });
    await setVehicleStatus(ID, "sold");
    expect(patches[0].sold_at).toEqual(expect.any(String));

    patches = mockClient({ status: "sold", published_at: "2026-01-01T00:00:00.000Z" });
    await setVehicleStatus(ID, "available");
    expect(patches[0]).toEqual({ status: "available", sold_at: null });
  });

  it("reports a missing vehicle", async () => {
    mockClient(null);
    expect(await setVehicleStatus(ID, "available")).toEqual({ error: "Vehicle not found" });
  });
});
