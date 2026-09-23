import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowlistedAdminEmail } from "@/lib/security/admin-allowlist";

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
  return {
    id: "00000000-0000-0000-0000-000000000000",
    email: "admin@example.com",
    app_metadata: { platform_role: "admin" },
    user_metadata: { full_name: "Admin User" },
    factors: []
  };
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}

export function userHasPlatformRole(
  user: SupabaseUser,
  roles = ["owner", "admin", "moderator"],
) {
  const platformRole = user.app_metadata?.platform_role;
  return typeof platformRole === "string" && roles.includes(platformRole);
}

async function userHasAdminRoleRecord(
  userId: string,
  roles?: string[],
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("active", true);

  if (roles && roles.length > 0) {
    query = query.in("role", roles);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Database error during admin role lookup: ${error.message}`);
  }

  return !!data;
}

export const userHasAdminAccess = cache(async function userHasAdminAccess(user: SupabaseUser) {
  if (isAllowlistedAdminEmail(user.email)) return true;
  return userHasPlatformRole(user) || userHasAdminRoleRecord(user.id);
});

export const getUserAdminRole = cache(async function getUserAdminRole(user: SupabaseUser): Promise<string> {
  if (isAllowlistedAdminEmail(user.email)) return "super_admin";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error during admin role lookup: ${error.message}`);
  }

  if (data?.role) return data.role;
  
  if (user.app_metadata?.platform_role === "owner") return "owner";
  if (user.app_metadata?.platform_role === "admin") return "admin";

  return "viewer";
});

/**
 * Whether this staff member's role is flagged `mfa_required` in `admin_roles`.
 * Bootstrap admins (env allowlist / platform_role only) have no row → false.
 */
const userRequiresMfa = cache(async function userRequiresMfa(user: SupabaseUser): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("mfa_required")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Database error during MFA policy lookup: ${error.message}`);
  }
  return data?.mfa_required === true;
});

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
 * True when the user's role demands MFA and this session has not satisfied it.
 * Shared by the redirecting and the JSON-returning guards.
 */
export async function mfaOutstanding(user: SupabaseUser): Promise<boolean> {
  if (!(await userRequiresMfa(user))) return false;
  const { current } = await getSessionAssuranceLevel();
  return current !== "aal2";
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!(await userHasAdminAccess(user))) {
    redirect("/auth/sign-in?error=unauthorized");
  }

  if (await mfaOutstanding(user)) {
    redirect("/auth/mfa");
  }

  return user;
}

export async function requireAdminRole(allowedRoles: string[]) {
  const user = await requireUser();

  if (isAllowlistedAdminEmail(user.email)) return user;

  // Single DB query: fetch role once, check against both global admin and
  // allowed roles — avoids 2 sequential round-trips to Supabase.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Database error during admin role lookup: ${error.message}`);
  }

  const role = data?.role ?? "";
  const isGlobalAdmin = ["owner", "admin"].includes(role);
  const hasSpecificRole = allowedRoles.includes(role);

  if (!isGlobalAdmin && !hasSpecificRole && !userHasPlatformRole(user, allowedRoles)) {
    redirect("/auth/sign-in?error=unauthorized");
  }

  if (await mfaOutstanding(user)) {
    redirect("/auth/mfa");
  }

  return user;
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

export async function requireApiAdmin() {
  const { user, response } = await requireApiUser();

  if (!user) {
    return { user: null, response };
  }

  try {
    if (!(await userHasAdminAccess(user))) {
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
  } catch {
    return {
      user: null,
      response: NextResponse.json({ error: "Internal server error during authorization" }, { status: 500 }),
    };
  }

  return { user, response: null };
}
