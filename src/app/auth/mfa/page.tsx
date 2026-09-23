import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireUser, userHasAdminAccess, getSessionAssuranceLevel } from "@/lib/security/auth";
import { createClient } from "@/lib/supabase/server";
import { MfaChallenge } from "@/components/auth/mfa-challenge";

export const metadata = { title: "Two-factor authentication", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Second-factor gate for staff whose role has `mfa_required`.
 *
 * Two states, decided server-side from Supabase's assurance levels:
 *  - `nextLevel === "aal2"` → a TOTP factor is enrolled; ask for the 6-digit code.
 *  - otherwise              → nothing enrolled; walk through enrolment (QR + code).
 * A session already at `aal2` is sent straight to the admin panel.
 */
export default async function MfaPage() {
  const user = await requireUser();
  if (!(await userHasAdminAccess(user))) {
    redirect("/auth/sign-in?error=unauthorized");
  }

  const { current, next } = await getSessionAssuranceLevel();
  if (current === "aal2") {
    redirect("/admin");
  }

  // A verified TOTP factor, if one exists, is what the challenge must target.
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === "verified") ?? null;
  const mode: "verify" | "enrol" = next === "aal2" && totp ? "verify" : "enrol";

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <ShieldCheck className="mb-3 size-10 text-primary" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {mode === "verify" ? "Enter your authentication code" : "Set up two-factor authentication"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "verify"
              ? "Your role requires a second factor. Open your authenticator app and enter the current 6-digit code."
              : "Your role requires a second factor. Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy), then enter the code it shows."}
          </p>
        </div>
        <MfaChallenge mode={mode} factorId={totp?.id ?? null} />
      </div>
    </main>
  );
}
