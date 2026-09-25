/**
 * Staff role → permission policy. The single source of truth for "who may do
 * what" in the admin panel; every page, Server Action and admin route handler
 * checks one of these permissions server-side (see `requirePermission` in
 * `./auth.ts`). Hiding a button is never the control.
 *
 * Roles mirror the `public.staff_role` enum (migration 0002):
 *   owner   — the business owner; the only role that can grant/revoke owner.
 *   admin   — full operational control, including staff management.
 *   manager — runs the yard: inventory, leads, invoices (incl. void), settings.
 *   sales   — day-to-day selling: inventory edits, leads, draft/issue invoices.
 *   content — website content: blog, FAQs, testimonials, email drafts.
 */
export const STAFF_ROLES = ["owner", "admin", "manager", "sales", "content"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);
}

const ALL: readonly StaffRole[] = STAFF_ROLES;
const MANAGEMENT: readonly StaffRole[] = ["owner", "admin", "manager"];
const SELLING: readonly StaffRole[] = ["owner", "admin", "manager", "sales"];
const CONTENT: readonly StaffRole[] = ["owner", "admin", "manager", "content"];
const ADMINS: readonly StaffRole[] = ["owner", "admin"];

export const PERMISSIONS = {
  "dashboard.view": ALL,

  "inventory.view": ALL,
  "inventory.write": SELLING, // create, edit, price, photos, status, featured
  "inventory.delete": MANAGEMENT,
  "inventory.bulk": MANAGEMENT,
  "catalogue.write": MANAGEMENT, // makes & models
  "syndication.manage": MANAGEMENT,

  "leads.view": SELLING,
  "leads.write": SELLING,
  "leads.delete": MANAGEMENT,

  "invoices.view": SELLING,
  "invoices.write": SELLING, // draft, edit draft, issue, record payment
  "invoices.void": MANAGEMENT,

  "content.write": CONTENT, // blog, FAQs, testimonials
  "content.delete": MANAGEMENT,

  "email.view": CONTENT,
  "email.write": CONTENT, // templates, campaign drafts, test send
  "email.send": ADMINS, // real sends to subscribers

  "settings.manage": MANAGEMENT, // business profile, ABN/GST, bank details
  "staff.manage": ADMINS,
  "audit.view": ADMINS,
} as const satisfies Record<string, readonly StaffRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: StaffRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

/**
 * Whether `actor` may grant or revoke `target`. Owner is the only role that
 * can create or remove owners, so an admin cannot promote themselves (or
 * anyone) past their own authority.
 */
export function canManageRole(actor: StaffRole | null | undefined, target: StaffRole): boolean {
  if (!roleCan(actor, "staff.manage")) return false;
  if (target === "owner") return actor === "owner";
  return true;
}
