"use client";

import { useActionState, useTransition, useEffect } from "react";
import { UserPlus, Shield, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { assignAdminRole, revokeAdminRole, restoreAdminRole } from "./actions";
import type { AdminRoleEntry, RoleActionState } from "./actions";

const ROLE_OPTIONS = [
  { value: "sales", label: "Sales", description: "Work leads (view, update, assign to self) & quick-change vehicle status", color: "bg-info-soft text-info border-info/20" },
  { value: "content", label: "Content", description: "Manage FAQs & testimonials only", color: "bg-accent-soft text-accent border-accent/20" },
  { value: "manager", label: "Manager", description: "Inventory, leads, content & reports (no users/settings)", color: "bg-success-soft text-success border-success/20" },
  { value: "admin", label: "Admin", description: "Full admin access except owner-only actions", color: "bg-warning-soft text-warning border-warning/20" },
  { value: "owner", label: "Owner", description: "Full control including users, settings & hard delete", color: "bg-danger-soft text-danger border-danger/20" },
];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-danger-soft text-danger border-danger/20",
  admin: "bg-warning-soft text-warning border-warning/20",
  manager: "bg-success-soft text-success border-success/20",
  sales: "bg-info-soft text-info border-info/20",
  content: "bg-accent-soft text-accent border-accent/20",
};

const initialAssignState: RoleActionState = { status: "idle", message: "" };

function AssignRoleForm() {
  const [state, action, isPending] = useActionState(assignAdminRole, initialAssignState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Card variant="elevated" className="border border-border bg-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="h-5 w-5 text-primary" />
          Grant Admin Access
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form action={action} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="assign-email">User email address <span className="text-danger">*</span></Label>
            <Input
              id="assign-email"
              name="email"
              type="email"
              required
              placeholder="staff@example.com"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">The user must already have an account on the platform.</p>
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-3 text-sm font-medium leading-none">Role <span className="text-danger">*</span></legend>
            <div className="grid gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/70 hover:bg-card hover:border-primary/30 cursor-pointer transition-all group"
                >
                  <input
                    type="radio"
                    name="role"
                    value={opt.value}
                    defaultChecked={opt.value === "sales"}
                    className="accent-primary"
                    required
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${opt.color}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/70">
            <input
              id="mfaRequired"
              type="checkbox"
              name="mfaRequired"
              value="true"
              defaultChecked
              className="accent-primary h-4 w-4"
            />
            <div>
              <Label htmlFor="mfaRequired" className="cursor-pointer font-semibold">Require MFA</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Enforce multi-factor authentication for this admin</p>
            </div>
          </div>

          <Button type="submit" size="cta" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Granting access…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Grant Admin Access
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RoleRow({ entry }: { entry: AdminRoleEntry }) {
  const [isPending, startTransition] = useTransition();
  const badgeColor = ROLE_COLORS[entry.role] ?? "bg-muted text-muted-foreground border-border";

  const handleRevoke = () => {
    startTransition(async () => {
      const res = await revokeAdminRole(entry.userId);
      if (res.status === "success") {
        toast.success(res.message);
      } else if (res.status === "error") {
        toast.error(res.message);
      }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const res = await restoreAdminRole(entry.userId);
      if (res.status === "success") {
        toast.success(res.message);
      } else if (res.status === "error") {
        toast.error(res.message);
      }
    });
  };

  return (
    <div
      className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all duration-200 ${
        entry.active
          ? "bg-card/70 border-border/60 hover:border-primary/20 hover:bg-card hover:shadow-sm"
          : "bg-muted/50 border-border opacity-60"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          entry.active ? "bg-success-soft text-success shadow-sm" : "bg-muted text-muted-foreground"
        }`}>
          {(entry.fullName || entry.email).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate">
            {entry.fullName ?? entry.email}
          </div>
          {entry.fullName && (
            <div className="text-xs text-muted-foreground truncate">{entry.email}</div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">
            Granted {new Date(entry.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-13 sm:ml-0 flex-wrap">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
          {entry.role}
        </span>
        {entry.mfaRequired && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-muted text-foreground border-border flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> MFA
          </span>
        )}
        {!entry.active && (
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
            Revoked
          </Badge>
        )}
        {entry.active ? (
          <button
            onClick={handleRevoke}
            disabled={isPending}
            className="ml-1 flex items-center gap-1.5 text-xs font-semibold text-danger hover:text-danger hover:bg-danger-soft px-3 py-1.5 rounded-xl border border-transparent transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
            Revoke
          </button>
        ) : (
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="ml-1 flex items-center gap-1.5 text-xs font-semibold text-success hover:text-success hover:bg-success-soft px-3 py-1.5 rounded-xl border border-transparent transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

export function RolesManager({ roles }: { roles: AdminRoleEntry[] }) {
  const activeRoles = roles.filter((r) => r.active);
  const revokedRoles = roles.filter((r) => !r.active);

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
      {/* Left: Assign form */}
      <div>
        <AssignRoleForm />
      </div>

      {/* Right: Current roles list */}
      <div className="space-y-6">
        {/* Active admins */}
        <Card variant="elevated">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Active Admins
              </span>
              <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {activeRoles.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {activeRoles.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No active admins. Grant access using the form.
              </div>
            ) : (
              <div className="space-y-2">
                {activeRoles.map((entry) => (
                  <RoleRow key={entry.userId} entry={entry} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revoked admins */}
        {revokedRoles.length > 0 && (
          <Card variant="elevated">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg text-muted-foreground">
                  <ShieldOff className="h-5 w-5" />
                  Revoked Access
                </span>
                <span className="text-sm font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {revokedRoles.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {revokedRoles.map((entry) => (
                  <RoleRow key={entry.userId} entry={entry} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
