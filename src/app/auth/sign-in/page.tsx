"use client";

import { Suspense } from "react";
import { Users, MessageCircle, BadgeDollarSign } from "lucide-react";
import { StaffSignIn } from "@/components/auth/staff-sign-in";
import { site } from "@/config/site";

function SignInContent() {
  return (
    <main className="dark flex min-h-screen bg-background">
      {/* Value Proposition Panel — Desktop only (≥1024px) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-border">
        <div className="max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground" style={{ letterSpacing: "-0.03em" }}>
              {site.brandName} staff sign-in
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Manage inventory, respond to leads and issue invoices.
            </p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Pre-inspected vehicles</h3>
                <p className="text-sm text-muted-foreground">
                  Every vehicle undergoes a rigorous inspection process before being listed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Fast support</h3>
                <p className="text-sm text-muted-foreground">
                  Get your questions answered quickly by our dedicated team.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BadgeDollarSign className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Transparent pricing</h3>
                <p className="text-sm text-muted-foreground">
                  What you see is what you pay. No hidden fees or surprises.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Card Panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-4 py-12 sm:px-6 lg:px-12">
        <StaffSignIn />
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={<div className="dark min-h-screen bg-background" />}
    >
      <SignInContent />
    </Suspense>
  );
}
