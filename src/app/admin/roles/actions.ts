"use server";

import type { User } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/security/auth";
import { canManageRole, isStaffRole, STAFF_ROLES, type StaffRole } from "@/lib/security/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveProfileFromUser } from "@/lib/auth/profile";
import { revalidatePath } from "next/cache";

export type AdminRoleEntry = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  active: boolean;
  mfaRequired: boolean;
  createdAt: string;
};

export type PendingRoleEntry = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

export type RoleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

/**
 * Roles that can manage staff must always present a second factor: a stolen
 * password for one of these accounts is a stolen business.
 */
const MFA_ENFORCED_ROLES: readonly StaffRole[] = ["owner", "admin"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Supabase = ReturnType<typeof createAdminClient>;

async function audit(
  supabase: Supabase,
  actorId: string,
  action: string,
  entityId: string | null,
  diff?: Record<string, unknown>,
) {
  const { error } = await supabase.from("activity_logs").insert({
    user_id: actorId,
    action,
    entity_type: "admin_role",
    entity_id: entityId,
    diff: diff ?? null,
  });
  if (error) console.error(`[roles] audit write failed for ${action}:`, error.message);
}

/** List all admin role holders with their profile and auth email */
export async function getAdminRoles(): Promise<AdminRoleEntry[]> {
  await requirePermission("staff.manage");
  const supabase = createAdminClient();

  // Fetch roles without relying on the PostgREST relationship cache
  const { data: rolesData, error: rolesError } = await supabase
    .from("admin_roles")
    .select("user_id, role, active, mfa_required, created_at")
    .order("created_at", { ascending: false });

  if (rolesError) throw new Error(`Failed to fetch admin roles: ${rolesError.message}`);

  const userIds = (rolesData ?? []).map((r) => r.user_id);

  let profilesMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));
  }

  return (rolesData ?? []).map((row) => {
    const profile = profilesMap.get(row.user_id);
    return {
      userId: row.user_id,
      email: profile?.email ?? "—",
      fullName: profile?.full_name ?? null,
      role: row.role,
      active: row.active,
      mfaRequired: row.mfa_required,
      createdAt: row.created_at,
    };
  });
}

/**
 * Finds an account by exact email in Supabase Auth — the only trustworthy
 * source. `profiles.email` is NOT used: a signed-up user can edit their own
 * profile row, so matching on it would let them claim a role meant for
 * someone else's address.
 */
async function findAuthUserByEmail(supabase: Supabase, email: string): Promise<User | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`User lookup failed: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (users.length < perPage) return null;
  }
  return null;
}

async function currentRoleOf(supabase: Supabase, userId: string): Promise<{ role: StaffRole; active: boolean } | null> {
  const { data } = await supabase.from("admin_roles").select("role, active").eq("user_id", userId).maybeSingle();
  return data && isStaffRole(data.role) ? { role: data.role, active: data.active } : null;
}

async function activeOwnerCount(supabase: Supabase): Promise<number> {
  const { count } = await supabase
    .from("admin_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("active", true);
  return count ?? 0;
}

/** Assign or update an admin role for a user */
export async function assignAdminRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const actor = await requirePermission("staff.manage");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  if (!isStaffRole(role)) {
    return { status: "error", message: `Invalid role. Allowed: ${STAFF_ROLES.join(", ")}.` };
  }

  if (!canManageRole(actor.staffRole, role)) {
    return { status: "error", message: "Only an owner can grant the owner role." };
  }

  const mfaRequired = MFA_ENFORCED_ROLES.includes(role) || formData.get("mfaRequired") === "true";
  const supabase = createAdminClient();

  let user: User | null;
  try {
    user = await findAuthUserByEmail(supabase, email);
  } catch (err) {
    console.error("[roles] lookup failed:", err);
    return { status: "error", message: "Could not look up that account. Please try again." };
  }

  if (!user) {
    // No account yet — store a pending role so it is applied automatically
    // the first time this person signs in with Google (a verified address).
    const { error: pendingError } = await supabase
      .from("pending_admin_roles")
      .upsert({ email, role, mfa_required: mfaRequired }, { onConflict: "email" });

    if (pendingError) {
      console.error("[roles] pending role save failed:", pendingError.message);
      return { status: "error", message: "Could not save the pending role. Please try again." };
    }

    await audit(supabase, actor.id, "admin_role_pending_created", null, { email, role, mfaRequired });
    revalidatePath("/admin/roles");
    return {
      status: "success",
      message: `Role "${role}" queued for ${email}. It is applied the first time they sign in with Google.`,
    };
  }

  if (user.id === actor.id) {
    return { status: "error", message: "You cannot change your own role." };
  }

  const existing = await currentRoleOf(supabase, user.id);
  if (existing && !canManageRole(actor.staffRole, existing.role)) {
    return { status: "error", message: "Only an owner can change another owner's role." };
  }
  if (existing?.role === "owner" && existing.active && role !== "owner" && (await activeOwnerCount(supabase)) <= 1) {
    return { status: "error", message: "The business must keep at least one active owner." };
  }

  // Ensure the profile row exists (admin_roles.user_id references it).
  await supabase.from("profiles").upsert(deriveProfileFromUser(user), { onConflict: "id" });

  const { error } = await supabase.from("admin_roles").upsert(
    { user_id: user.id, role, active: true, mfa_required: mfaRequired },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[roles] assign failed:", error.message);
    return { status: "error", message: "Failed to assign the role. Please try again." };
  }

  await audit(supabase, actor.id, "admin_role_assigned", user.id, {
    email,
    role,
    previousRole: existing?.role ?? null,
    mfaRequired,
  });

  revalidatePath("/admin/roles");

  return {
    status: "success",
    message: `Role "${role}" assigned to ${user.email}.`,
  };
}

/** List all pending (not-yet-signed-up) role assignments */
export async function getPendingAdminRoles(): Promise<PendingRoleEntry[]> {
  await requirePermission("staff.manage");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_admin_roles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[roles] pending list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at,
  }));
}

/** Cancel a pending role invitation */
export async function cancelPendingRole(id: string): Promise<RoleActionState> {
  const actor = await requirePermission("staff.manage");
  const supabase = createAdminClient();
  const { data: pending } = await supabase.from("pending_admin_roles").select("email, role").eq("id", id).maybeSingle();
  if (!pending) return { status: "error", message: "That invitation no longer exists." };
  if (isStaffRole(pending.role) && !canManageRole(actor.staffRole, pending.role)) {
    return { status: "error", message: "Only an owner can cancel an owner invitation." };
  }
  const { error } = await supabase.from("pending_admin_roles").delete().eq("id", id);
  if (error) return { status: "error", message: "Failed to cancel the invitation." };
  await audit(supabase, actor.id, "admin_role_pending_cancelled", null, { email: pending.email, role: pending.role });
  revalidatePath("/admin/roles");
  return { status: "success", message: "Pending invitation cancelled." };
}

async function setRoleActive(userId: string, active: boolean): Promise<RoleActionState> {
  const actor = await requirePermission("staff.manage");
  const supabase = createAdminClient();

  if (userId === actor.id) {
    return { status: "error", message: "You cannot change your own access." };
  }

  const existing = await currentRoleOf(supabase, userId);
  if (!existing) return { status: "error", message: "That staff member was not found." };
  if (!canManageRole(actor.staffRole, existing.role)) {
    return { status: "error", message: "Only an owner can change an owner's access." };
  }
  if (!active && existing.role === "owner" && existing.active && (await activeOwnerCount(supabase)) <= 1) {
    return { status: "error", message: "The business must keep at least one active owner." };
  }

  const { error } = await supabase.from("admin_roles").update({ active }).eq("user_id", userId);
  if (error) {
    console.error("[roles] update failed:", error.message);
    return { status: "error", message: "Failed to update access. Please try again." };
  }

  await audit(supabase, actor.id, active ? "admin_role_restored" : "admin_role_revoked", userId, { role: existing.role });
  revalidatePath("/admin/roles");
  return { status: "success", message: active ? "Admin access restored." : "Admin access revoked." };
}

/** Revoke (deactivate) an admin role */
export async function revokeAdminRole(userId: string): Promise<RoleActionState> {
  return setRoleActive(userId, false);
}

/** Restore (reactivate) a previously revoked admin role */
export async function restoreAdminRole(userId: string): Promise<RoleActionState> {
  return setRoleActive(userId, true);
}
