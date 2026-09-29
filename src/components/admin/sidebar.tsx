"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Car, Inbox, MessageSquareQuote, HelpCircle,
  Settings, Users, ScrollText, Menu, X, BookMarked, Receipt, Mail, PenTool
} from "lucide-react";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";
import type { Permission } from "@/lib/security/permissions";

const NAV: { href: string; label: string; icon: typeof Car; exact?: boolean; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard.view" },
  { href: "/admin/inventory", label: "Inventory", icon: Car, permission: "inventory.view" },
  { href: "/admin/leads", label: "Leads", icon: Inbox, permission: "leads.view" },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt, permission: "invoices.view" },
  { href: "/admin/email", label: "Email Marketing", icon: Mail, permission: "email.view" },
  { href: "/admin/blog", label: "Blog CMS", icon: PenTool, permission: "content.write" },
  { href: "/admin/catalogue", label: "Brands & Models", icon: BookMarked, permission: "catalogue.write" },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote, permission: "content.write" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, permission: "content.write" },
  { href: "/admin/roles", label: "Users & Roles", icon: Users, permission: "staff.manage" },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
];

/**
 * `permissions` is computed on the server from the staff role. Filtering the
 * nav is a convenience only — every page enforces its own permission.
 */
export function AdminSidebar({
  userEmail,
  userName,
  role,
  permissions,
}: {
  userEmail?: string;
  userName?: string;
  role?: string;
  permissions: Permission[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const links = (
    <nav aria-label="Admin" className="flex flex-col gap-1 p-3">
      {NAV.filter((item) => permissions.includes(item.permission)).map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active 
                ? "bg-accent-soft text-accent-soft-foreground border-l-4 border-accent" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-4 border-transparent",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = (
    <div className="shrink-0 border-t border-border p-4 space-y-3">
      {/* User info */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-bold">
          {(userName ?? userEmail ?? "A")[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          {userName && <p className="truncate text-sm font-semibold text-foreground">{userName}</p>}
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          {role && (
            <span className="inline-block mt-0.5 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-bright capitalize">
              {role.replace("_", " ")}
            </span>
          )}
        </div>
      </div>
      {/* Sign out */}
      <form action="/auth/sign-out" method="POST" className="w-full">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="dark flex items-center justify-between border-b border-border bg-background p-3 lg:hidden text-foreground print:hidden">
        <Link href="/admin" className="font-heading text-lg font-extrabold text-foreground">{site.brandName} <span className="text-accent-bright">Admin</span></Link>
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="admin-sidebar" className="rounded-lg p-2 text-foreground hover:bg-muted">
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        id="admin-sidebar"
        className={cn(
          "dark flex w-64 flex-none flex-col bg-background text-foreground lg:sticky lg:top-0 lg:h-screen border-r border-border print:hidden",
          open ? "flex" : "hidden lg:flex",
        )}
      >
        {/* Logo */}
        <div className="shrink-0 hidden items-center gap-2 border-b border-border p-4 lg:flex">
          <Link href="/admin" className="font-heading text-lg font-extrabold text-foreground">{site.brandName} <span className="text-accent-bright">Admin</span></Link>
        </div>
        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto">
          {links}
        </div>
        {/* Always-visible footer */}
        {userFooter}
      </aside>
    </>
  );
}
