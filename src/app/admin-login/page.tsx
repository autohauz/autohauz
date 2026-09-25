import { redirect } from "next/navigation";

// Staff path: dynamic so it carries the proxy's per-request nonce CSP.
export const dynamic = "force-dynamic";

/** Legacy route — send admins to Supabase sign-in with MFA notice. */
export default function AdminLoginPage() {
  redirect("/auth/sign-in?redirectedFrom=/admin&reason=mfa-required");
}
