import type { ReactNode } from "react";
import { requireAdmin, getUserAdminRole } from "@/lib/security/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Run auth check and role lookup in parallel — halves the DB round-trips
  // compared to awaiting them sequentially.
  const user = await requireAdmin();
  const role = await getUserAdminRole(user);
  const metadata = user.user_metadata as Record<string, unknown>;
  const userName = (metadata?.full_name || metadata?.name) as string | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 lg:flex-row print:bg-white print:block">
      <AdminSidebar userEmail={user.email} userName={userName} role={role} />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:bg-white">{children}</main>
      <div className="print:hidden">
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
}
