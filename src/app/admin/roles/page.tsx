import { Shield, ShieldAlert } from "lucide-react";
import { requirePermission } from "@/lib/security/auth";
import { getAdminRoles } from "./actions";
import { RolesManager } from "./roles-manager";

export const metadata = {
  title: "Role Management",
};

export default async function AdminRolesPage() {
  await requirePermission("staff.manage");

  const roles = await getAdminRoles();
  const activeCount = roles.filter((r) => r.active).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <section className="flex flex-col gap-3 border-b border-border/50 pb-6 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 bg-accent-soft rounded-2xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              Role Management
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl font-medium">
              Manage who has access to the admin portal and what they can do. Owners and admins manage staff; only an owner can grant or remove the owner role.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-black text-foreground">{activeCount}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Admins</div>
            </div>
          </div>
        </div>
      </section>

      {/* Role permissions reference */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { role: "Sales", desc: "Inventory edits, leads, draft & issue invoices, record payments", icon: "💬", color: "border-info/20 bg-info-soft" },
          { role: "Content", desc: "Blog, FAQs, testimonials and email drafts", icon: "📝", color: "border-accent/20 bg-accent-soft" },
          { role: "Manager", desc: "Everything sales can do, plus deletes, invoice void, bulk upload and settings", icon: "📊", color: "border-success/20 bg-success-soft" },
          { role: "Admin / Owner", desc: "Full control incl. staff, audit log and campaign sends (MFA enforced)", icon: "👑", color: "border-warning/20 bg-warning-soft" },
        ].map((item) => (
          <div key={item.role} className={`rounded-2xl border p-4 ${item.color}`}>
            <div className="text-2xl mb-2">{item.icon}</div>
            <div className="font-bold text-foreground text-sm">{item.role}</div>
            <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-5 py-4">
        <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-warning-foreground">Important security notes</p>
          <ul className="mt-1.5 space-y-1 text-warning-foreground list-disc list-inside">
            <li>Emails without an account get a pending role, applied when they first sign in with Google</li>
            <li>MFA is enforced for owner and admin; recommended for every role</li>
            <li>Revoked access can be restored — users are never deleted from this table</li>
            <li>All role changes are logged in the Audit trail</li>
          </ul>
        </div>
      </div>

      {/* Role manager UI */}
      <RolesManager roles={roles} />
    </div>
  );
}
