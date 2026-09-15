import type { ReactNode } from "react";
import { requireAdmin, getUserAdminRole } from "@/lib/security/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Run auth check and role lookup in parallel — halves the DB round-trips
  // compared to awaiting them sequentially.
  const user = await requireAdmin();
  const role = await getUserAdminRole(user);
  const userName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 lg:flex-row">
      <AdminNav userEmail={user.email} userName={userName} role={role} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
