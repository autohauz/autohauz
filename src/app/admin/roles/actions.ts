"use server";

import { requireAdminRole } from "@/lib/security/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type RoleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const VALID_ROLES = ["owner", "admin", "manager", "sales", "content"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

function isValidRole(role: string): role is ValidRole {
  return (VALID_ROLES as readonly string[]).includes(role);
}

/** List all admin role holders with their profile and auth email */
export async function getAdminRoles(): Promise<AdminRoleEntry[]> {
  await requireAdminRole(["owner", "admin", "super_admin"]);
  const supabase = createAdminClient();

  // Fetch roles without relying on the PostgREST relationship cache
  const { data: rolesData, error: rolesError } = await supabase
    .from("admin_roles")
    .select("user_id, role, active, mfa_required, created_at")
    .order("created_at", { ascending: false });

  if (rolesError) throw new Error(`Failed to fetch admin roles: ${rolesError.message}`);

  const userIds = (rolesData ?? []).map((r) => r.user_id);

  // Fetch corresponding profiles
  let profilesMap = new Map();
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

/** Search for a user by email so admin can assign a role */
export async function searchUserByEmail(
  email: string,
): Promise<{ id: string; email: string; fullName: string | null } | null> {
  await requireAdminRole(["owner", "admin", "super_admin"]);

  const supabase = createAdminClient();

  // Search via profiles table (which has email column)
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", email.trim())
    .maybeSingle();

  if (profileData) {
    return {
      id: profileData.id,
      email: profileData.email ?? email,
      fullName: profileData.full_name,
    };
  }

  // Fallback: search auth.users via admin API
  const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = (listData?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase(),
  );

  if (match) {
    // Before returning, ensure they exist in the profiles table to prevent foreign key errors
    // when assigning admin_roles.
    const { deriveProfileFromUser } = await import("@/lib/auth/profile");
    await supabase.from("profiles").upsert(deriveProfileFromUser(match), { onConflict: "id" });
    
    return {
      id: match.id,
      email: match.email!,
      fullName: match.user_metadata?.full_name ?? null,
    };
  }

  return null;
}

/** Assign or update an admin role for a user */
export async function assignAdminRole(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireAdminRole(["owner", "admin", "super_admin"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const mfaRequired = formData.get("mfaRequired") === "true";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  if (!isValidRole(role)) {
    return { status: "error", message: `Invalid role "${role}". Allowed: ${VALID_ROLES.join(", ")}.` };
  }

  const supabase = createAdminClient();

  // Look up the user
  let user = await searchUserByEmail(email);
  if (!user) {
    return {
      status: "error",
      message: `No account found for "${email}". The person must sign up at cars-365.com.au first before you can grant them admin access.`,
    };
  }

  // Upsert admin role
  const { error } = await supabase.from("admin_roles").upsert(
    {
      user_id: user.id,
      role,
      active: true,
      mfa_required: mfaRequired,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { status: "error", message: `Failed to assign role: ${error.message}` };
  }

  // Audit log
  const actingUser = await requireAdminRole(["owner", "admin", "super_admin"]);
  await supabase.from("activity_logs").insert({
    user_id: actingUser.id,
    action: "admin_role_assigned",
    entity_type: "admin_role",
    entity_id: user.id,
    diff: { email, role, mfaRequired },
  });

  revalidatePath("/admin/roles");

  return {
    status: "success",
    message: `Role "${role}" assigned to ${user.email}${user.fullName ? ` (${user.fullName})` : ""} successfully.`,
  };
}

/** Revoke (deactivate) an admin role */
export async function revokeAdminRole(userId: string): Promise<RoleActionState> {
  const actingUser = await requireAdminRole(["owner", "admin", "super_admin"]);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("admin_roles")
    .update({ active: false })
    .eq("user_id", userId);

  if (error) {
    return { status: "error", message: `Failed to revoke role: ${error.message}` };
  }

  await supabase.from("activity_logs").insert({
    user_id: actingUser.id,
    action: "admin_role_revoked",
    entity_type: "admin_role",
    entity_id: userId,
  });

  revalidatePath("/admin/roles");
  return { status: "success", message: "Admin access revoked." };
}

/** Restore (reactivate) a previously revoked admin role */
export async function restoreAdminRole(userId: string): Promise<RoleActionState> {
  const actingUser = await requireAdminRole(["owner", "admin", "super_admin"]);
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("admin_roles")
    .update({ active: true })
    .eq("user_id", userId);

  if (error) {
    return { status: "error", message: `Failed to restore role: ${error.message}` };
  }

  await supabase.from("activity_logs").insert({
    user_id: actingUser.id,
    action: "admin_role_restored",
    entity_type: "admin_role",
    entity_id: userId,
  });

  revalidatePath("/admin/roles");
  return { status: "success", message: "Admin access restored." };
}
