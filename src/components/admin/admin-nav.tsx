"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Car, Inbox, MessageSquareQuote, HelpCircle,
  Settings, Users, ScrollText, Menu, X, BookMarked, ServerCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/inventory", label: "Inventory", icon: Car },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/catalogue", label: "Brands & Models", icon: BookMarked },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/roles", label: "Users & Roles", icon: Users },
  { href: "/admin/api-usage", label: "API Usage", icon: ServerCog },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export function AdminNav({ userEmail, role }: { userEmail?: string; role?: string }) {
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
              active ? "bg-primary text-primary-foreground" : "text-slate-300 hover:bg-card/5 hover:text-white",
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
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950 p-3 lg:hidden">
        <Link href="/admin" className="font-heading text-lg font-extrabold text-white">Cars<span className="text-primary">365</span> Admin</Link>
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu" className="rounded-lg p-2 text-white hover:bg-card/10">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={cn(
          "flex w-64 flex-none flex-col bg-slate-950 lg:sticky lg:top-0 lg:h-screen",
          open ? "block" : "hidden lg:flex",
        )}
      >
        <div className="hidden items-center gap-2 border-b border-white/10 p-4 lg:flex">
          <Link href="/admin" className="font-heading text-lg font-extrabold text-white">Cars<span className="text-primary">365</span> Admin</Link>
        </div>
        {links}
        <div className="mt-auto border-t border-white/10 p-4 text-xs text-slate-400">
          <p className="truncate text-slate-300">{userEmail}</p>
          {role ? <p className="capitalize">{role.replace("_", " ")}</p> : null}
          <form action="/auth/sign-out" method="POST">
            <button type="submit" className="mt-2 inline-block text-slate-400 hover:text-white text-left">Sign out</button>
          </form>
        </div>
      </aside>
    </>
  );
}
