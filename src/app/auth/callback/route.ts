import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeAdminRedirect } from "@/lib/routing";
import { sendWelcomeEmail } from "@/lib/email/ses";
import { deriveProfileFromUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/lib/security/permissions";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  // Only staff authenticate; send them to their intended admin page or the panel.
  const destination = safeAdminRedirect(rawNext);

  const supabase = await createClient();

  // ─── OAuth Code Exchange ──────────────────────────────────────────────────
  // This block only runs when Google (or another OAuth provider) redirects back
  // with a one-time `code`. Email/password sign-ins do NOT pass a code here.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth exchange failed:", error.message);
      return NextResponse.redirect(
        new URL("/auth/sign-in?error=auth_failed", requestUrl.origin),
      );
    }

    if (data.user) {
      const admin = createAdminClient();

      await admin.from("profiles").upsert(deriveProfileFromUser(data.user));

      // ── Pending role auto-apply ────────────────────────────────────────────
      // If an admin pre-assigned a role for this email before the user had an
      // account, apply it now and remove the pending entry. The address is
      // verified: this callback only runs after an OAuth provider (or an
      // emailed confirmation link) proved ownership of it.
      if (data.user.email) {
        const email = data.user.email.toLowerCase();
        const { data: pending } = await admin
          .from("pending_admin_roles")
          .select("id, role, mfa_required")
          // Exact match: emails are stored lower-cased, and `ilike` would treat
          // `_`/`%` in an address as wildcards.
          .eq("email", email)
          .maybeSingle();

        if (pending && isStaffRole(pending.role)) {
          const { error: grantError } = await admin.from("admin_roles").upsert(
            {
              user_id: data.user.id,
              role: pending.role,
              active: true,
              mfa_required: pending.mfa_required ?? false,
            },
            { onConflict: "user_id" },
          );
          if (grantError) {
            console.error("[auth/callback] pending role grant failed:", grantError.message);
          } else {
            await admin.from("pending_admin_roles").delete().eq("id", pending.id);
            await admin.from("activity_logs").insert({
              user_id: data.user.id,
              action: "admin_role_pending_applied",
              entity_type: "admin_role",
              entity_id: data.user.id,
              diff: { role: pending.role },
            });
            // Welcome only people who actually became staff. Anyone can sign
            // in with Google; a non-staff account gets no email and no access.
            const name = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? email.split("@")[0];
            sendWelcomeEmail({ to: email, name }).catch((err) =>
              console.error("[auth/callback] welcome email failed:", err instanceof Error ? err.message : err),
            );
          }
        }
      }
      // ── End pending role ───────────────────────────────────────────────────
    }
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
