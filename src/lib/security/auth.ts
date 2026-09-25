import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowlistedAdminEmail } from "@/lib/security/admin-allowlist";
import { isStaffRole, roleCan, type Permission, type StaffRole } from "@/lib/security/permissions";

export type { Permission, StaffRole } from "@/lib/security/permissions";

type SupabaseUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  factors?: unknown[];
};

/**
 * The authenticated user for this request, verified against Supabase Auth.
 *
 * Deliberately NO `getSession()` fallback: `getSession()` returns whatever the
 * cookie says without server-side verification, so a transient auth-API error
 * would silently downgrade admin access to "trust the cookie". If the auth
 * service is unreachable the caller sees no user and the request is denied —
 * a retry is the correct outcome, not a bypass.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}

/** `app_metadata.platform_role` — set only by the service role, never by the user. */
export function userHasPlatformRole(user: SupabaseUser, roles: readonly string[] = ["owner", "admin"]) {
  const platformRole = user.app_metadata?.platform_role;
  return typeof platformRole === "string" && roles.includes(platformRole);
}

type StaffGrant = { role: StaffRole; mfaRequired: boolean };

/**
 * The staff grant for a user, or null when they are not staff.
 *
 * Precedence: an active `admin_roles` row (the primary authority) →
 * `platform_role` app-metadata (owner/admin only) → the env bootstrap
 * allowlist, which maps to `owner` so the first administrator can reach the
 * panel before any role rows exist. One query per request (memoised).
 */
export const getStaffGrant = cache(async function getStaffGrant(user: SupabaseUser): Promise<StaffGrant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("role, mfa_required")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error during admin role lookup: ${error.message}`);
  }

  if (data && isStaffRole(data.role)) {
    return { role: data.role, mfaRequired: data.mfa_required === true };
  }

  const platformRole = user.app_metadata?.platform_role;
  if (platformRole === "owner" || platformRole === "admin") {
    return { role: platformRole, mfaRequired: false };
  }

  if (isAllowlistedAdminEmail(user.email)) {
    return { role: "owner", mfaRequired: false };
  }

  return null;
});

export async function getStaffRole(user: SupabaseUser): Promise<StaffRole | null> {
  return (await getStaffGrant(user))?.role ?? null;
}

export const userHasAdminAccess = cache(async function userHasAdminAccess(user: SupabaseUser) {
  return (await getStaffGrant(user)) !== null;
});

/** Role label for the admin chrome. Non-staff never reach the admin layout. */
export async function getUserAdminRole(user: SupabaseUser): Promise<StaffRole | "none"> {
  return (await getStaffRole(user)) ?? "none";
}

/**
 * Authenticator assurance level of the current session, as verified by
 * Supabase. `aal2` means a second factor was presented this session.
 */
export const getSessionAssuranceLevel = cache(async function getSessionAssuranceLevel() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel ?? null, next: data?.nextLevel ?? null };
});

/**
 * True when this session still owes a second factor: either the role demands
 * MFA, or the user has enrolled a factor (`nextLevel === "aal2"`) — an
 * enrolled factor that can be skipped protects nothing.
 */
export async function mfaOutstanding(user: SupabaseUser): Promise<boolean> {
  const grant = await getStaffGrant(user);
  const { current, next } = await getSessionAssuranceLevel();
  if (current === "aal2") return false;
  return grant?.mfaRequired === true || next === "aal2";
}

/**
 * Page/Server Action guard: the signed-in user must be staff holding
 * `permission`, with any outstanding second factor satisfied. Redirects
 * otherwise. Call it in every admin page, Server Action and data function
 * that reads private data — layouts are not an authorization boundary.
 */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  const role = await getStaffRole(user);

  if (!role) {
    redirect("/auth/sign-in?error=unauthorized");
  }

  if (await mfaOutstanding(user)) {
    redirect("/auth/mfa");
  }

  if (!roleCan(role, permission)) {
    redirect("/admin?denied=1");
  }

  return Object.assign(user, { staffRole: role });
}

/** Any active staff member (the admin shell and dashboard). */
export function requireAdmin() {
  return requirePermission("dashboard.view");
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  return { user, response: null };
}

/** Route-handler guard: JSON 401/403 instead of redirects. */
export async function requireApiPermission(permission: Permission) {
  const { user, response } = await requireApiUser();

  if (!user) {
    return { user: null, response };
  }

  try {
    const role = await getStaffRole(user);
    if (!role) {
      return {
        user: null,
        response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
      };
    }
    if (await mfaOutstanding(user)) {
      return {
        user: null,
        response: NextResponse.json({ error: "Multi-factor authentication required", code: "mfa_required" }, { status: 403 }),
      };
    }
    if (!roleCan(role, permission)) {
      return {
        user: null,
        response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
      };
    }
  } catch {
    return {
      user: null,
      response: NextResponse.json({ error: "Internal server error during authorization" }, { status: 500 }),
    };
  }

  return { user, response: null };
}

export function requireApiAdmin() {
  return requireApiPermission("dashboard.view");
}
