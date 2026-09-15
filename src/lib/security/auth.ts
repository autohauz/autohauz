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

export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    // Fallback to reading the cryptographically signed JWT if the API check fails
    // due to network timeouts on Vercel Node/Edge runtime.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return sessionData.session.user;
    }
    return null;
  }

  return data.user;
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

  const { data } = await query.limit(1).maybeSingle();

  return !!data;
}

export const userHasAdminAccess = cache(async function userHasAdminAccess(user: SupabaseUser) {
  if (isAllowlistedAdminEmail(user.email)) return true;
  return userHasPlatformRole(user) || userHasAdminRoleRecord(user.id);
});

export const getUserAdminRole = cache(async function getUserAdminRole(user: SupabaseUser): Promise<string> {
  if (isAllowlistedAdminEmail(user.email)) return "super_admin";

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (data?.role) return data.role;
  
  if (user.app_metadata?.platform_role === "owner") return "owner";
  if (user.app_metadata?.platform_role === "admin") return "admin";

  return "viewer";
});

export async function requireAdmin() {
  const user = await requireUser();

  if (!(await userHasAdminAccess(user))) {
    redirect("/");
  }

  return user;
}

export async function requireAdminRole(allowedRoles: string[]) {
  const user = await requireUser();

  if (isAllowlistedAdminEmail(user.email)) return user;

  // Single DB query: fetch role once, check against both global admin and
  // allowed roles — avoids 2 sequential round-trips to Supabase.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const role = data?.role ?? "";
  const isGlobalAdmin = ["owner", "admin"].includes(role);
  const hasSpecificRole = allowedRoles.includes(role);

  if (!isGlobalAdmin && !hasSpecificRole && !userHasPlatformRole(user, allowedRoles)) {
    redirect("/");
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

  if (!(await userHasAdminAccess(user))) {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { user, response: null };
}
