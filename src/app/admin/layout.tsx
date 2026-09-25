import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/security/auth";
import { PERMISSIONS, roleCan, type Permission } from "@/lib/security/permissions";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "sonner";

export const dynamic = "force-dynamic";

// Private area: never indexed (the proxy also sends X-Robots-Tag), and every
// admin page title is marked as admin in the browser tab.
export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const role = user.staffRole;
  const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => roleCan(role, p));
  const metadata = user.user_metadata as Record<string, unknown>;
  const userName = (metadata?.full_name || metadata?.name) as string | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 lg:flex-row print:bg-white print:block">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[var(--z-modal)] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-card-foreground"
      >
        Skip to content
      </a>
      <AdminSidebar userEmail={user.email} userName={userName} role={role} permissions={permissions} />
      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0 print:m-0 print:bg-white">{children}</main>
      <div className="print:hidden">
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
}
