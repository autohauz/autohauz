import { describe, expect, it } from "vitest";
import { decodeSegment, isAdminZone, isSafeRedirectPath, safeAdminRedirect } from "./routing";

describe("isSafeRedirectPath", () => {
  it.each(["/admin", "/admin/leads?status=new", "/used-cars#top"])("accepts %s", (p) => {
    expect(isSafeRedirectPath(p)).toBe(true);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/%09/evil.com".replace("%09", "\t"),
    "javascript:alert(1)",
    "/javascript:alert(1)",
    "admin",
    "",
  ])("rejects %j", (p) => {
    expect(isSafeRedirectPath(p)).toBe(false);
  });
});

describe("safeAdminRedirect", () => {
  it("keeps admin destinations", () => {
    expect(safeAdminRedirect("/admin/invoices/123")).toBe("/admin/invoices/123");
    expect(safeAdminRedirect("/admin?tab=x")).toBe("/admin?tab=x");
  });

  it("falls back to /admin for anything else", () => {
    for (const bad of [null, undefined, "", "/", "/used-cars", "/administrator", "//evil.com", "javascript:alert(1)", "/\t/evil.com"]) {
      expect(safeAdminRedirect(bad)).toBe("/admin");
    }
  });
});

describe("isAdminZone", () => {
  it("matches only the admin segment", () => {
    expect(isAdminZone("/admin")).toBe(true);
    expect(isAdminZone("/admin/leads")).toBe(true);
    expect(isAdminZone("/admin-login")).toBe(false);
    expect(isAdminZone("/administrator")).toBe(false);
  });
});

describe("decodeSegment", () => {
  it("decodes percent-encoded route params", () => {
    expect(decodeSegment("2019-mitsubishi-pajero%20sport-gls-d006")).toBe("2019-mitsubishi-pajero sport-gls-d006");
    expect(decodeSegment("2023-kia-sportage-gt-line-d005")).toBe("2023-kia-sportage-gt-line-d005");
  });

  it("returns malformed escapes unchanged instead of throwing", () => {
    expect(decodeSegment("bad%E0%A4%A")).toBe("bad%E0%A4%A");
  });
});
