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

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/inventory", label: "Inventory", icon: Car },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/email", label: "Email Marketing", icon: Mail },
  { href: "/admin/blog", label: "Blog CMS", icon: PenTool },
  { href: "/admin/catalogue", label: "Brands & Models", icon: BookMarked },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/roles", label: "Users & Roles", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ userEmail, userName, role }: { userEmail?: string; userName?: string; role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const links = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active 
                ? "bg-accent-soft text-accent-soft-foreground border-l-4 border-accent" 
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-4 border-transparent",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="dark flex items-center justify-between border-b border-border bg-background p-3 lg:hidden text-foreground print:hidden">
        <Link href="/admin" className="font-heading text-lg font-extrabold text-foreground">{site.brandName} <span className="text-accent-bright">Admin</span></Link>
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu" className="rounded-lg p-2 text-foreground hover:bg-muted">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={cn(
          "dark flex w-64 flex-none flex-col bg-background text-foreground lg:sticky lg:top-0 lg:h-screen border-r border-border print:hidden",
          open ? "block" : "hidden lg:flex",
        )}
      >
        <div className="hidden items-center gap-2 border-b border-border p-4 lg:flex">
          <Link href="/admin" className="font-heading text-lg font-extrabold text-foreground">{site.brandName} <span className="text-accent-bright">Admin</span></Link>
        </div>
        {links}
        <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground">
          {userName && <p className="truncate font-semibold text-foreground">{userName}</p>}
          <p className="truncate">{userEmail}</p>
          {role ? <p className="capitalize">{role.replace("_", " ")}</p> : null}
          <form action="/auth/sign-out" method="POST">
            <button type="submit" className="mt-2 inline-block text-muted-foreground hover:text-foreground text-left transition-colors">Sign out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
