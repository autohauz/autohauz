import { describe, expect, it } from "vitest";
import { canManageRole, isStaffRole, PERMISSIONS, roleCan, STAFF_ROLES, type Permission } from "./permissions";

describe("roleCan", () => {
  it("denies everything to a missing role", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      expect(roleCan(null, p)).toBe(false);
      expect(roleCan(undefined, p)).toBe(false);
    }
  });

  it("gives owner every permission", () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) expect(roleCan("owner", p)).toBe(true);
  });

  it("keeps staff management and audit to owner/admin", () => {
    for (const role of ["manager", "sales", "content"] as const) {
      expect(roleCan(role, "staff.manage")).toBe(false);
      expect(roleCan(role, "audit.view")).toBe(false);
      expect(roleCan(role, "email.send")).toBe(false);
    }
  });

  it("lets sales sell but not destroy", () => {
    expect(roleCan("sales", "leads.write")).toBe(true);
    expect(roleCan("sales", "invoices.write")).toBe(true);
    expect(roleCan("sales", "inventory.write")).toBe(true);
    expect(roleCan("sales", "leads.delete")).toBe(false);
    expect(roleCan("sales", "invoices.void")).toBe(false);
    expect(roleCan("sales", "inventory.delete")).toBe(false);
    expect(roleCan("sales", "settings.manage")).toBe(false);
  });

  it("confines content to website content and email drafts", () => {
    expect(roleCan("content", "content.write")).toBe(true);
    expect(roleCan("content", "email.write")).toBe(true);
    expect(roleCan("content", "leads.view")).toBe(false);
    expect(roleCan("content", "invoices.view")).toBe(false);
    expect(roleCan("content", "inventory.write")).toBe(false);
  });

  it("only references real roles", () => {
    for (const roles of Object.values(PERMISSIONS)) {
      for (const r of roles) expect(isStaffRole(r)).toBe(true);
    }
  });
});

describe("canManageRole", () => {
  it("lets only an owner grant or remove owner", () => {
    expect(canManageRole("owner", "owner")).toBe(true);
    expect(canManageRole("admin", "owner")).toBe(false);
  });

  it("lets owner/admin manage non-owner roles", () => {
    for (const target of STAFF_ROLES.filter((r) => r !== "owner")) {
      expect(canManageRole("owner", target)).toBe(true);
      expect(canManageRole("admin", target)).toBe(true);
    }
  });

  it("denies lower roles entirely", () => {
    for (const actor of ["manager", "sales", "content", null] as const) {
      for (const target of STAFF_ROLES) expect(canManageRole(actor, target)).toBe(false);
    }
  });
});

describe("isStaffRole", () => {
  it("rejects legacy/unknown role strings", () => {
    for (const v of ["super_admin", "viewer", "moderator", "", null, 1]) expect(isStaffRole(v)).toBe(false);
  });
});
