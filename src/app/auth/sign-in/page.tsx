"use client";

import { Suspense } from "react";
import { Car, Inbox, Receipt } from "lucide-react";
import { StaffSignIn } from "@/components/auth/staff-sign-in";
import { site } from "@/config/site";

const TOOLS = [
  { icon: Car, title: "Inventory", body: "List cars, update prices and manage photos." },
  { icon: Inbox, title: "Leads", body: "Respond to enquiries and track each one to a sale." },
  { icon: Receipt, title: "Invoices", body: "Issue tax invoices and record payments." },
];

function SignInContent() {
  return (
    <main id="main" className="dark flex min-h-screen bg-background">
      {/* Context panel — desktop only. Staff-facing: no marketing claims. */}
      <div className="hidden items-center justify-center border-r border-border p-12 lg:flex lg:w-1/2">
        <div className="max-w-md space-y-8">
          <div>
            <p className="font-heading text-3xl font-bold tracking-tight text-foreground">{site.brandName} admin</p>
            <p className="mt-3 text-lg text-muted-foreground">The staff workspace for the dealership.</p>
          </div>
          <ul className="space-y-5">
            {TOOLS.map((t) => (
              <li key={t.title} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                  <t.icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-foreground">{t.title}</span>
                  <span className="block text-sm text-muted-foreground">{t.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-12">
        <StaffSignIn />
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="dark min-h-screen bg-background" />}>
      <SignInContent />
    </Suspense>
  );
}
